import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { putNoteFile, type GitHubNotesConfig } from './github-notes.js';
import {
  appendSyndicationUrl,
  detectPublishTransition,
  liveNoteHasObjectId,
  readPromotedCommitSha,
  shouldCreateBlueskyCopy,
  shouldDistribute,
  type PublishTransition,
} from './distribution.js';
import { posseNoteToBluesky } from '../syndication/bluesky.js';
import { sendWebmentions } from '../webmentions/send-outbound.js';

const SITE = 'https://karthikg.in';

export function productionEnvironment(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const environment = (payload as Record<string, unknown>).environment;
  return environment === 'production' || environment === undefined;
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function listNotePathsAt(commitSha: string): string[] {
  const output = git(['diff-tree', '--no-commit-id', '--name-only', '-r', commitSha, '--', 'src/content/notes']);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function readFileAtCommit(commitSha: string, path: string): string | null {
  try {
    return git(['show', `${commitSha}:${path}`]);
  } catch {
    return null;
  }
}

export function parentCommitSha(commitSha: string): string | null {
  try {
    const parent = git(['rev-parse', `${commitSha}^`]);
    return parent || null;
  } catch {
    return null;
  }
}

export function publishTransitionsAt(commitSha: string): PublishTransition[] {
  const parent = parentCommitSha(commitSha);
  const transitions: PublishTransition[] = [];
  for (const path of listNotePathsAt(commitSha)) {
    const after = readFileAtCommit(commitSha, path);
    if (!after) continue;
    const before = parent ? readFileAtCommit(parent, path) : null;
    const transition = detectPublishTransition(path, before, after);
    if (transition) transitions.push(transition);
  }
  return transitions;
}

export async function verifyLivePublishedNote(input: {
  slug: string;
  objectId: string;
  fetchImpl?: typeof fetch;
  attempts?: number;
  delayMs?: number;
}): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts = input.attempts ?? 12;
  const delayMs = input.delayMs ?? 5000;
  const url = `${SITE}/notes/${input.slug}/`;

  let lastStatus = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchImpl(url, { headers: { 'User-Agent': 'karthikg.in distribution' } });
    lastStatus = response.status;
    const html = await response.text();
    if (response.ok && liveNoteHasObjectId(html, input.objectId)) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Live URL did not match ObjectId ${input.objectId} (last HTTP ${lastStatus}).`);
}

export async function commitSyndicationUrl(input: {
  config: GitHubNotesConfig;
  slug: string;
  url: string;
}): Promise<boolean> {
  const { getNoteFile } = await import('./github-notes.js');
  const current = await getNoteFile(input.config, input.slug);
  if (!current) throw new Error(`Canonical Note ${input.slug} disappeared before syndication commit.`);
  const next = appendSyndicationUrl(current.text, input.url);
  if (!next.changed) return false;
  try {
    await putNoteFile(input.config, {
      slug: input.slug,
      text: next.text,
      message: `syndication(note): ${input.slug}`,
      sha: current.sha,
    });
    return true;
  } catch (error) {
    const retried = await getNoteFile(input.config, input.slug);
    if (retried && !appendSyndicationUrl(retried.text, input.url).changed) return false;
    throw error;
  }
}

export async function distributePublishTransition(
  transition: PublishTransition,
  options: {
    github?: GitHubNotesConfig;
    skipNetwork?: boolean;
  } = {}
): Promise<void> {
  if (!shouldDistribute(transition)) {
    console.log(`${transition.slug}: distribution intent is off; skipping`);
    return;
  }

  if (!options.skipNetwork) {
    await verifyLivePublishedNote({ slug: transition.slug, objectId: transition.objectId });
  }

  if (transition.intent.webmentions) {
    await sendWebmentions({ slug: transition.slug });
  }

  if (shouldCreateBlueskyCopy(transition)) {
    const url = await posseNoteToBluesky(transition.slug);
    console.log(`bluesky ${url}`);
    if (options.github) {
      const wrote = await commitSyndicationUrl({ config: options.github, slug: transition.slug, url });
      console.log(wrote ? `wrote syndication for ${transition.slug}` : `syndication already present for ${transition.slug}`);
    } else {
      console.log(`Add this to the note frontmatter:\n\nsyndication:\n  - ${url}`);
    }
  }
}

export async function runDistributePublishedNote(input: {
  payload?: unknown;
  commitSha?: string;
}): Promise<void> {
  if (input.payload && !productionEnvironment(input.payload)) {
    console.log('Not a production promotion; skipping');
    return;
  }

  const commitSha = input.commitSha
    ?? (input.payload ? readPromotedCommitSha(input.payload) : null);
  if (!commitSha) {
    throw new Error('Could not read the promoted deployment commit SHA.');
  }

  const transitions = publishTransitionsAt(commitSha).filter(shouldDistribute);
  if (transitions.length === 0) {
    console.log('No opted-in publish transitions in this commit.');
    return;
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? 'karthikg80/personal-site').split('/');
  const github = token
    ? { token, owner: owner || 'karthikg80', repo: repo || 'personal-site', branch: 'main' }
    : undefined;

  for (const transition of transitions) {
    console.log(`distribute ${transition.slug} ${transition.objectId}`);
    await distributePublishTransition(transition, { github });
  }
}

export async function loadGithubEventPayload(): Promise<unknown> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  const raw = await readFile(eventPath, 'utf8');
  const event = JSON.parse(raw) as { client_payload?: unknown; inputs?: { commit?: string } };
  return event.client_payload ?? event;
}
