import { ensureCanonicalId } from '../lib/publishing/canonical-id';
import {
  applyPrepareSuccess,
  buildPrepareRequest,
  captureEditorialSnapshot,
  derivePrepareUi,
  isCanonicalPrepared,
  isWorkingCopyDirty,
  relationshipsFromReplyToUrl,
  type EditorialSnapshot,
} from '../lib/publishing/drafting-prepare-state';
import { buildHandoffMarkdown } from '../lib/publishing/handoff';

type ReviewKey = 'firsthand' | 'facts' | 'people' | 'location' | 'voice';
type AgentMode = 'interview' | 'shapes' | 'draft' | 'privacy' | 'voice' | 'custom';

type AgentNote = {
  id: string;
  mode: AgentMode;
  text: string;
  createdAt: string;
};

type Draft = {
  id: string;
  canonicalId?: string;
  slug?: string;
  slugManual?: boolean;
  date?: string;
  tags?: string[];
  presentation?: 'note' | 'scrap';
  summary?: string;
  title: string;
  sparks: string;
  body: string;
  voiceNote: string;
  review: Record<ReviewKey, boolean>;
  agentNotes: AgentNote[];
  blobSha?: string;
  commitSha?: string;
  preparedAt?: string;
  publishedAt?: string;
  lastPreparedSnapshot?: EditorialSnapshot;
  privacyAcknowledged?: boolean;
  replyToUrl?: string;
  distributeWebmentions?: boolean;
  distributeBluesky?: boolean;
  createdAt: string;
  updatedAt: string;
};

type NotebookState = {
  version: 1;
  activeDraftId: string;
  drafts: Draft[];
};

type EncryptedNotebook = {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
};

const STORAGE_KEY = 'kg-encrypted-drafting-room-v1';
const HANDOFF_KEY = 'kg-drafting-key-handoff';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const reviewKeys: ReviewKey[] = ['firsthand', 'facts', 'people', 'location', 'voice'];

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing drafting-room element: ${id}`);
  return found as T;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function blankDraft(): Draft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    sparks: '',
    body: '',
    voiceNote: '',
    review: { firsthand: false, facts: false, people: false, location: false, voice: false },
    agentNotes: [],
    createdAt: now,
    updatedAt: now,
  };
}

function blankNotebook(): NotebookState {
  const draft = blankDraft();
  return { version: 1, activeDraftId: draft.id, drafts: [draft] };
}

function isNotebookState(value: unknown): value is NotebookState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NotebookState>;
  return candidate.version === 1
    && typeof candidate.activeDraftId === 'string'
    && Array.isArray(candidate.drafts)
    && candidate.drafts.every((draft) => draft && typeof draft.id === 'string');
}

async function deriveKey(phrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(phrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 310_000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decryptNotebook(phrase: string, stored: EncryptedNotebook): Promise<{ key: CryptoKey; state: NotebookState; salt: Uint8Array }> {
  const salt = base64ToBytes(stored.salt);
  const key = await deriveKey(phrase, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(stored.iv) as BufferSource },
    key,
    base64ToBytes(stored.ciphertext) as BufferSource
  );
  const parsed = JSON.parse(decoder.decode(plaintext)) as unknown;
  if (!isNotebookState(parsed)) throw new Error('Invalid notebook data.');
  return { key, state: parsed, salt };
}

async function encryptNotebook(key: CryptoKey, salt: Uint8Array, state: NotebookState): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(JSON.stringify(state))
  );
  const stored: EncryptedNotebook = {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

const accessForm = document.getElementById('access-form') as HTMLFormElement | null;

if (accessForm) {
  const accessKey = element<HTMLInputElement>('access-key');
  const accessStatus = element<HTMLParagraphElement>('access-status');

  accessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = accessForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    accessStatus.textContent = 'checking…';

    try {
      const response = await fetch('/api/drafting/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: accessKey.value }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'The room stayed closed.');

      sessionStorage.setItem(HANDOFF_KEY, accessKey.value);
      accessKey.value = '';
      window.location.reload();
    } catch (error) {
      accessStatus.textContent = error instanceof Error ? error.message : 'The room stayed closed.';
      if (submit) submit.disabled = false;
    }
  });
} else if (document.getElementById('vault-form')) {
  const vaultGate = element<HTMLElement>('vault-gate');
  const vaultForm = element<HTMLFormElement>('vault-form');
  const vaultKey = element<HTMLInputElement>('vault-key');
  const vaultStatus = element<HTMLParagraphElement>('vault-status');
  const room = element<HTMLElement>('drafting-room');
  const titleInput = element<HTMLInputElement>('draft-title');
  const sparksInput = element<HTMLTextAreaElement>('draft-sparks');
  const bodyInput = element<HTMLTextAreaElement>('draft-body');
  const voiceInput = element<HTMLTextAreaElement>('voice-note');
  const saveState = element<HTMLSpanElement>('save-state');
  const draftList = element<HTMLOListElement>('draft-list');
  const agentLog = element<HTMLDivElement>('agent-log');
  const agentStatus = element<HTMLParagraphElement>('agent-status');
  const agentMessage = element<HTMLTextAreaElement>('agent-message');
  const handoffStatus = element<HTMLParagraphElement>('handoff-status');
  const slugInput = element<HTMLInputElement>('prepare-slug');
  const dateInput = element<HTMLInputElement>('prepare-date');
  const tagsInput = element<HTMLInputElement>('prepare-tags');
  const presentationSelect = element<HTMLSelectElement>('prepare-presentation');
  const summaryInput = element<HTMLTextAreaElement>('prepare-summary');
  const replyToInput = element<HTMLInputElement>('prepare-reply-to');
  const privacyAck = element<HTMLInputElement>('privacy-acknowledgement');
  const distributeWebmentions = element<HTMLInputElement>('distribute-webmentions');
  const distributeBluesky = element<HTMLInputElement>('distribute-bluesky');
  const prepareButton = element<HTMLButtonElement>('prepare-canonical');
  const reviewLink = element<HTMLAnchorElement>('review-canonical');
  const prepareGitStatus = element<HTMLParagraphElement>('prepare-git-status');
  const prepareWorkingStatus = element<HTMLParagraphElement>('prepare-working-status');
  const prepareFutureUrl = element<HTMLParagraphElement>('prepare-future-url');
  const prepareStatus = element<HTMLParagraphElement>('prepare-status');

  let notebook: NotebookState | null = null;
  let encryptionKey: CryptoKey | null = null;
  let notebookSalt: Uint8Array | null = null;
  let saveTimer: number | undefined;
  let saveQueue: Promise<void> = Promise.resolve();

  function utcToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function parseTags(value: string): string[] {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  function slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled-note';
  }

  function currentSlug(draft: Draft): string {
    if (isCanonicalPrepared(draft) && draft.slug) return draft.slug;
    if (draft.slugManual && draft.slug) return draft.slug;
    return slugify(titleInput.value || draft.title);
  }

  function editorialFromDraft(draft: Draft): EditorialSnapshot {
    return captureEditorialSnapshot({
      title: draft.title,
      date: draft.date || utcToday(),
      tags: draft.tags ?? [],
      presentation: draft.presentation ?? 'note',
      summary: draft.summary ?? '',
      body: draft.body,
      sparks: draft.sparks,
      relationships: relationshipsFromReplyToUrl(draft.replyToUrl),
    });
  }

  function currentDraft(): Draft {
    if (!notebook) throw new Error('Notebook is locked.');
    const current = notebook.drafts.find((draft) => draft.id === notebook?.activeDraftId);
    if (!current) {
      const replacement = blankDraft();
      notebook.drafts.push(replacement);
      notebook.activeDraftId = replacement.id;
      return replacement;
    }
    return current;
  }

  function syncInputsToDraft(): void {
    if (!notebook) return;
    const draft = currentDraft();
    draft.title = titleInput.value;
    draft.sparks = sparksInput.value;
    draft.body = bodyInput.value;
    draft.voiceNote = voiceInput.value;
    draft.date = dateInput.value || utcToday();
    draft.tags = parseTags(tagsInput.value);
    draft.presentation = presentationSelect.value === 'scrap' ? 'scrap' : 'note';
    draft.summary = summaryInput.value;
    draft.replyToUrl = replyToInput.value.trim();
    draft.privacyAcknowledged = privacyAck.checked;
    draft.distributeWebmentions = distributeWebmentions.checked;
    draft.distributeBluesky = distributeBluesky.checked;
    if (!isCanonicalPrepared(draft)) {
      draft.slug = slugInput.value.trim() || slugify(draft.title);
    }
    draft.updatedAt = new Date().toISOString();
    for (const key of reviewKeys) {
      const checkbox = document.querySelector<HTMLInputElement>(`[data-check="${key}"]`);
      draft.review[key] = checkbox?.checked ?? false;
    }
  }

  function renderPrepareUi(): void {
    const draft = currentDraft();
    const snapshot = editorialFromDraft(draft);
    const ui = derivePrepareUi({
      linkage: draft,
      snapshot,
      privacyAcknowledged: privacyAck.checked,
    });

    slugInput.disabled = ui.slugLocked;
    slugInput.value = currentSlug(draft);
    prepareButton.textContent = ui.prepareLabel;
    prepareButton.disabled = !ui.canPrepare || prepareButton.getAttribute('aria-busy') === 'true';
    prepareGitStatus.textContent = ui.gitStatus;
    prepareWorkingStatus.textContent = ui.workingStatus;

    const slug = currentSlug(draft);
    prepareFutureUrl.textContent = `Future URL: https://karthikg.in/notes/${slug}/`;

    if (ui.reviewHref) {
      reviewLink.hidden = false;
      reviewLink.href = ui.reviewHref;
    } else {
      reviewLink.hidden = true;
      reviewLink.removeAttribute('href');
    }
  }

  function clearLocalAcknowledgementIfDirty(): void {
    const draft = currentDraft();
    const snapshot = editorialFromDraft(draft);
    if (!isCanonicalPrepared(draft)) return;
    if (!isWorkingCopyDirty(snapshot, draft.lastPreparedSnapshot)) return;
    if (!draft.privacyAcknowledged && !privacyAck.checked) return;
    draft.privacyAcknowledged = false;
    privacyAck.checked = false;
  }

  async function refreshPublishedStatus(): Promise<void> {
    const draft = currentDraft();
    if (!draft.canonicalId || !draft.slug || draft.publishedAt) return;
    try {
      const params = new URLSearchParams({ id: draft.canonicalId, slug: draft.slug });
      const response = await fetch(`/api/drafting/canonical?${params}`, { credentials: 'same-origin' });
      if (!response.ok) return;
      const result = await response.json() as { draft?: boolean };
      if (result.draft === false) {
        draft.publishedAt = new Date().toISOString();
        scheduleSave();
        renderPrepareUi();
      }
    } catch {
      // Lookup is best-effort; stay on the last known local state.
    }
  }

  function scheduleSave(): void {
    saveState.textContent = 'saving…';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      if (!notebook || !encryptionKey || !notebookSalt) return;
      syncInputsToDraft();
      const snapshot = structuredClone(notebook);
      const key = encryptionKey;
      const salt = notebookSalt;
      saveQueue = saveQueue
        .then(() => encryptNotebook(key, salt, snapshot))
        .then(() => { saveState.textContent = 'saved on this device'; })
        .catch(() => { saveState.textContent = 'could not save—export a copy'; });
    }, 450);
  }

  function renderDraftList(): void {
    if (!notebook) return;
    draftList.replaceChildren();
    const sorted = [...notebook.drafts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    for (const draft of sorted) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const title = document.createElement('strong');
      const time = document.createElement('time');
      button.type = 'button';
      button.dataset.draftId = draft.id;
      button.setAttribute('aria-current', String(draft.id === notebook.activeDraftId));
      title.textContent = draft.title.trim() || 'Untitled note';
      time.dateTime = draft.updatedAt;
      time.textContent = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(draft.updatedAt));
      button.append(title, time);
      button.addEventListener('click', () => {
        syncInputsToDraft();
        if (!notebook) return;
        notebook.activeDraftId = draft.id;
        renderWorkspace();
        scheduleSave();
      });
      item.append(button);
      draftList.append(item);
    }
  }

  function renderAgentLog(): void {
    agentLog.replaceChildren();
    const notes = currentDraft().agentNotes.slice().reverse();
    for (const note of notes) {
      const card = document.createElement('article');
      const header = document.createElement('header');
      const label = document.createElement('span');
      const time = document.createElement('time');
      const text = document.createElement('p');
      card.className = 'agent-card';
      label.textContent = note.mode;
      time.dateTime = note.createdAt;
      time.textContent = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(note.createdAt));
      header.append(label, time);
      text.textContent = note.text;
      card.append(header, text);

      if (note.mode === 'draft') {
        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.textContent = 'place in current draft';
        useButton.addEventListener('click', () => {
          bodyInput.value = note.text;
          showStage('shape');
          syncInputsToDraft();
          clearLocalAcknowledgementIfDirty();
          renderPrepareUi();
          scheduleSave();
          bodyInput.focus();
        });
        card.append(useButton);
      }
      agentLog.append(card);
    }
  }

  function renderWorkspace(): void {
    const draft = currentDraft();
    titleInput.value = draft.title;
    sparksInput.value = draft.sparks;
    bodyInput.value = draft.body;
    voiceInput.value = draft.voiceNote;
    dateInput.value = draft.date || utcToday();
    tagsInput.value = (draft.tags ?? []).join(', ');
    presentationSelect.value = draft.presentation ?? 'note';
    summaryInput.value = draft.summary ?? '';
    replyToInput.value = draft.replyToUrl ?? '';
    slugInput.value = currentSlug(draft);
    const snapshot = editorialFromDraft(draft);
    const dirty = isCanonicalPrepared(draft) && isWorkingCopyDirty(snapshot, draft.lastPreparedSnapshot);
    if (dirty) draft.privacyAcknowledged = false;
    privacyAck.checked = draft.privacyAcknowledged ?? false;
    distributeWebmentions.checked = draft.distributeWebmentions ?? false;
    distributeBluesky.checked = draft.distributeBluesky ?? false;
    for (const key of reviewKeys) {
      const checkbox = document.querySelector<HTMLInputElement>(`[data-check="${key}"]`);
      if (checkbox) checkbox.checked = draft.review[key];
    }
    renderDraftList();
    renderAgentLog();
    renderPrepareUi();
    void refreshPublishedStatus();
  }

  function showStage(stage: string): void {
    document.querySelectorAll<HTMLButtonElement>('.stage-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.stage === stage);
    });
    document.querySelectorAll<HTMLElement>('.stage-panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== stage;
    });
  }

  async function unlockNotebook(phrase: string): Promise<void> {
    const storedRaw = localStorage.getItem(STORAGE_KEY);
    if (storedRaw) {
      const stored = JSON.parse(storedRaw) as EncryptedNotebook;
      if (stored.version !== 1) throw new Error('This notebook version is not supported.');
      const unlocked = await decryptNotebook(phrase, stored);
      encryptionKey = unlocked.key;
      notebookSalt = unlocked.salt;
      notebook = unlocked.state;
    } else {
      notebookSalt = crypto.getRandomValues(new Uint8Array(16));
      encryptionKey = await deriveKey(phrase, notebookSalt);
      notebook = blankNotebook();
      await encryptNotebook(encryptionKey, notebookSalt, notebook);
    }

    vaultKey.value = '';
    vaultGate.hidden = true;
    room.hidden = false;
    renderWorkspace();
    titleInput.focus();
  }

  vaultForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = vaultForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) submit.disabled = true;
    vaultStatus.textContent = 'unlocking…';
    try {
      await unlockNotebook(vaultKey.value);
      vaultStatus.textContent = '';
    } catch {
      vaultStatus.textContent = 'That phrase could not unlock this notebook.';
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  for (const input of [titleInput, sparksInput, bodyInput]) {
    input.addEventListener('input', () => {
      if (input === titleInput && !currentDraft().slugManual && !isCanonicalPrepared(currentDraft())) {
        slugInput.value = slugify(titleInput.value);
      }
      syncInputsToDraft();
      clearLocalAcknowledgementIfDirty();
      if (input === titleInput) renderDraftList();
      renderPrepareUi();
      scheduleSave();
    });
  }
  voiceInput.addEventListener('input', () => {
    syncInputsToDraft();
    scheduleSave();
  });
  for (const input of [slugInput, dateInput, tagsInput, summaryInput, replyToInput]) {
    input.addEventListener('input', () => {
      if (input === slugInput) currentDraft().slugManual = true;
      syncInputsToDraft();
      clearLocalAcknowledgementIfDirty();
      renderPrepareUi();
      scheduleSave();
    });
  }
  presentationSelect.addEventListener('change', () => {
    syncInputsToDraft();
    clearLocalAcknowledgementIfDirty();
    renderPrepareUi();
    scheduleSave();
  });
  privacyAck.addEventListener('change', () => {
    syncInputsToDraft();
    renderPrepareUi();
    scheduleSave();
  });
  distributeWebmentions.addEventListener('change', () => {
    syncInputsToDraft();
    scheduleSave();
  });
  distributeBluesky.addEventListener('change', () => {
    syncInputsToDraft();
    scheduleSave();
  });
  document.querySelectorAll<HTMLInputElement>('[data-check]').forEach((checkbox) => checkbox.addEventListener('change', scheduleSave));
  document.querySelectorAll<HTMLButtonElement>('.stage-button').forEach((button) => button.addEventListener('click', () => showStage(button.dataset.stage ?? 'gather')));

  element<HTMLButtonElement>('new-draft').addEventListener('click', () => {
    if (!notebook) return;
    syncInputsToDraft();
    const draft = blankDraft();
    notebook.drafts.push(draft);
    notebook.activeDraftId = draft.id;
    showStage('gather');
    renderWorkspace();
    scheduleSave();
  });

  element<HTMLButtonElement>('lock-room').addEventListener('click', async () => {
    window.clearTimeout(saveTimer);
    if (notebook && encryptionKey && notebookSalt) {
      syncInputsToDraft();
      await saveQueue;
      await encryptNotebook(encryptionKey, notebookSalt, notebook);
    }
    notebook = null;
    encryptionKey = null;
    notebookSalt = null;
    titleInput.value = '';
    sparksInput.value = '';
    bodyInput.value = '';
    voiceInput.value = '';
    agentLog.replaceChildren();
    room.hidden = true;
    vaultGate.hidden = false;
    vaultKey.focus();
  });

  document.getElementById('leave-room')?.addEventListener('click', async () => {
    await fetch('/api/drafting/session', { method: 'DELETE', credentials: 'same-origin' });
    window.location.reload();
  });

  async function askAgent(mode: AgentMode, message = ''): Promise<void> {
    const draft = currentDraft();
    const buttons = document.querySelectorAll<HTMLButtonElement>('[data-agent-mode], #agent-form button');
    buttons.forEach((button) => { button.disabled = true; });
    agentStatus.textContent = 'the agent is reading this version…';

    try {
      const response = await fetch('/api/drafting/agent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title: draft.title,
          sparks: draft.sparks,
          draft: draft.body,
          message,
          conversation: draft.agentNotes.slice(-6).map((note) => `${note.mode}: ${note.text}`),
        }),
      });
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error ?? 'The agent did not answer.');

      draft.agentNotes.push({ id: crypto.randomUUID(), mode, text: result.text, createdAt: new Date().toISOString() });
      draft.updatedAt = new Date().toISOString();
      agentMessage.value = '';
      renderAgentLog();
      scheduleSave();
      agentStatus.textContent = 'suggestion added to this encrypted draft';
    } catch (error) {
      agentStatus.textContent = error instanceof Error ? error.message : 'The agent did not answer.';
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  document.querySelectorAll<HTMLButtonElement>('[data-agent-mode]').forEach((button) => {
    button.addEventListener('click', () => askAgent(button.dataset.agentMode as AgentMode));
  });

  element<HTMLFormElement>('agent-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!agentMessage.value.trim()) {
      agentStatus.textContent = 'Write a question first.';
      return;
    }
    void askAgent('custom', agentMessage.value);
  });

  function markdownHandoff(): { filename: string; content: string; complete: boolean } {
    syncInputsToDraft();
    const draft = currentDraft();
    draft.canonicalId = ensureCanonicalId(draft.canonicalId);
    scheduleSave();
    const body = draft.body.trim() || draft.sparks.trim();
    const complete = reviewKeys.every((key) => draft.review[key]);
    const slug = isCanonicalPrepared(draft) && draft.slug ? draft.slug : slugify(draft.title);
    const { filename, content } = buildHandoffMarkdown({
      canonicalId: draft.canonicalId,
      title: draft.title,
      slug,
      date: draft.date || utcToday(),
      body,
    });
    return { filename, content, complete };
  }

  element<HTMLButtonElement>('copy-handoff').addEventListener('click', async () => {
    const handoff = markdownHandoff();
    await navigator.clipboard.writeText(handoff.content);
    handoffStatus.textContent = `${handoff.complete
      ? 'Copied with publication disabled. Exact-text approval and the Git review still remain.'
      : 'Copied with publication disabled. Some human review checks are still open.'} Do not treat this file as privacy-reviewed.`;
  });

  element<HTMLButtonElement>('download-handoff').addEventListener('click', () => {
    const handoff = markdownHandoff();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([handoff.content], { type: 'text/markdown;charset=utf-8' }));
    link.download = handoff.filename;
    link.click();
    URL.revokeObjectURL(link.href);
    handoffStatus.textContent = 'Downloaded a plaintext Markdown handoff with publication disabled. Do not treat this file as privacy-reviewed.';
  });

  prepareButton.addEventListener('click', async () => {
    syncInputsToDraft();
    const draft = currentDraft();
    const snapshot = editorialFromDraft(draft);
    const ui = derivePrepareUi({
      linkage: draft,
      snapshot,
      privacyAcknowledged: privacyAck.checked,
    });
    if (!ui.canPrepare) return;
    if (!draft.body.trim() && !draft.sparks.trim()) {
      prepareStatus.textContent = 'Add a body or sparks first.';
      return;
    }

    draft.canonicalId = ensureCanonicalId(draft.canonicalId);
    const slug = currentSlug(draft);
    const payload = buildPrepareRequest({
      canonicalId: draft.canonicalId,
      slug,
      title: draft.title,
      date: draft.date || utcToday(),
      tags: draft.tags ?? [],
      presentation: draft.presentation ?? 'note',
      summary: draft.summary,
      body: draft.body,
      sparks: draft.sparks,
      replyToUrl: replyToInput.value,
      distribution: {
        webmentions: distributeWebmentions.checked,
        bluesky: distributeBluesky.checked,
      },
    });

    prepareButton.disabled = true;
    prepareButton.setAttribute('aria-busy', 'true');
    prepareStatus.textContent = 'writing the canonical draft…';

    try {
      const response = await fetch('/api/drafting/prepare', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as {
        ok?: boolean;
        error?: string;
        objectId?: string;
        slug?: string;
        blobSha?: string;
        commitSha?: string;
      };

      if (response.status === 503) {
        prepareStatus.textContent = result.error ?? 'GitHub is not configured for notes.';
        return;
      }

      if (!response.ok || !result.ok || !result.objectId || !result.slug || !result.blobSha) {
        if (response.status === 409 && /published/i.test(result.error ?? '')) {
          draft.publishedAt = new Date().toISOString();
          scheduleSave();
        }
        prepareStatus.textContent = result.error ?? 'Prepare failed.';
        return;
      }

      const next = applyPrepareSuccess(
        draft,
        {
          objectId: result.objectId,
          slug: result.slug,
          blobSha: result.blobSha,
          commitSha: result.commitSha,
        },
        snapshot,
        new Date().toISOString()
      );
      Object.assign(draft, next);
      slugInput.value = draft.slug ?? slug;
      privacyAck.checked = true;
      prepareStatus.textContent = 'Canonical draft prepared. Review the Git revision before publishing.';
      scheduleSave();
    } catch {
      prepareStatus.textContent = 'Prepare failed.';
    } finally {
      prepareButton.removeAttribute('aria-busy');
      renderPrepareUi();
    }
  });

  element<HTMLButtonElement>('delete-draft').addEventListener('click', () => {
    if (!notebook) return;
    const draft = currentDraft();
    if (!window.confirm(`Discard “${draft.title.trim() || 'Untitled note'}” from this browser? This cannot be undone.`)) return;
    notebook.drafts = notebook.drafts.filter((item) => item.id !== draft.id);
    if (notebook.drafts.length === 0) notebook.drafts.push(blankDraft());
    notebook.activeDraftId = notebook.drafts[0].id;
    showStage('gather');
    renderWorkspace();
    scheduleSave();
  });

  const handedOffPhrase = sessionStorage.getItem(HANDOFF_KEY);
  if (handedOffPhrase) {
    sessionStorage.removeItem(HANDOFF_KEY);
    void unlockNotebook(handedOffPhrase).catch(() => {
      vaultStatus.textContent = 'The access phrase opened the room but not this notebook. Enter its notebook phrase.';
    });
  }
}
