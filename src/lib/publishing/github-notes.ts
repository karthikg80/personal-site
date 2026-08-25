import { parseCanonicalNoteFile } from './note-markdown.js';
import { NOTES_DIR, noteRepoPath } from './note-path.js';

export type GitHubNotesConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export type NoteBlob = {
  sha: string;
  text: string;
};

export type RecoveredNoteFile = {
  slug: string;
  sha: string;
  text: string;
};

export class GitHubNotesError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubNotesError';
    this.status = status;
  }
}

export function getNotesConfig(): GitHubNotesConfig | null {
  const token = process.env.GITHUB_NOTES_TOKEN?.trim();
  if (!token) return null;

  return {
    token,
    owner: process.env.GITHUB_NOTES_OWNER?.trim() || 'karthikg80',
    repo: process.env.GITHUB_NOTES_REPO?.trim() || 'personal-site',
    branch: process.env.GITHUB_NOTES_BRANCH?.trim() || 'main',
  };
}

function apiHeaders(config: GitHubNotesConfig): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'karthikg.in-drafting',
  };
}

function fileContentsUrl(config: GitHubNotesConfig, slug: string): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${noteRepoPath(slug)}`;
}

function directoryContentsUrl(config: GitHubNotesConfig): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${NOTES_DIR}?ref=${encodeURIComponent(config.branch)}`;
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function getNoteFile(config: GitHubNotesConfig, slug: string): Promise<NoteBlob | null> {
  const response = await fetch(`${fileContentsUrl(config, slug)}?ref=${encodeURIComponent(config.branch)}`, {
    headers: apiHeaders(config),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GitHubNotesError(response.status, 'GitHub Contents request failed.');
  }

  const payload = (await readJson(response)) as { sha?: unknown; content?: unknown; encoding?: unknown };
  if (typeof payload.sha !== 'string' || typeof payload.content !== 'string') {
    throw new GitHubNotesError(502, 'GitHub Contents response was unreadable.');
  }

  return { sha: payload.sha, text: decodeBase64(payload.content) };
}

export async function putNoteFile(
  config: GitHubNotesConfig,
  input: { slug: string; text: string; message: string; sha?: string }
): Promise<{ sha: string; commitSha: string }> {
  const body: Record<string, string> = {
    message: input.message,
    content: Buffer.from(input.text, 'utf8').toString('base64'),
    branch: config.branch,
  };
  if (input.sha) body.sha = input.sha;

  const response = await fetch(fileContentsUrl(config, input.slug), {
    method: 'PUT',
    headers: {
      ...apiHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new GitHubNotesError(response.status, 'GitHub Contents update failed.');
  }

  const payload = (await readJson(response)) as {
    content?: { sha?: unknown };
    commit?: { sha?: unknown };
  };
  const sha = payload.content?.sha;
  const commitSha = payload.commit?.sha;
  if (typeof sha !== 'string' || typeof commitSha !== 'string') {
    throw new GitHubNotesError(502, 'GitHub Contents update response was unreadable.');
  }

  return { sha, commitSha };
}

type DirectoryEntry = {
  name?: unknown;
  type?: unknown;
  path?: unknown;
};

export async function findNoteByObjectId(
  config: GitHubNotesConfig,
  objectId: string
): Promise<RecoveredNoteFile | null> {
  const response = await fetch(directoryContentsUrl(config), {
    headers: apiHeaders(config),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GitHubNotesError(response.status, 'GitHub Contents request failed.');
  }

  const payload = await readJson(response);
  if (!Array.isArray(payload)) return null;

  for (const entry of payload as DirectoryEntry[]) {
    if (entry.type !== 'file' || typeof entry.name !== 'string' || !entry.name.endsWith('.md')) {
      continue;
    }
    const stem = entry.name.slice(0, -3);
    if (stem === 'README') continue;

    const file = await getNoteFile(config, stem);
    if (!file) continue;
    try {
      const parsed = parseCanonicalNoteFile(file.text);
      if (parsed.fields.id === objectId) {
        return { slug: stem, sha: file.sha, text: file.text };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function recoverNoteFile(
  config: GitHubNotesConfig,
  input: { objectId: string; slug?: string }
): Promise<RecoveredNoteFile | null> {
  if (input.slug) {
    const file = await getNoteFile(config, input.slug);
    if (!file) return null;
    try {
      const parsed = parseCanonicalNoteFile(file.text);
      if (parsed.fields.id !== input.objectId) return null;
      return { slug: input.slug, sha: file.sha, text: file.text };
    } catch {
      return null;
    }
  }

  return findNoteByObjectId(config, input.objectId);
}
