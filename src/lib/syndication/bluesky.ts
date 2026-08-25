import { readFile } from 'node:fs/promises';

import { buildBlueskyPostText } from '../../adapters/syndication/bluesky/post-text.js';
import { derivePublicationState, isPublicPublication } from '../../core/domain/publication.js';
import { parseCanonicalNoteFile } from '../publishing/note-markdown.js';
import { tidFromObjectId, uuidV7TimestampMs } from './tid.js';

const SITE = 'https://karthikg.in';

export type BlueskySession = {
  did: string;
  accessJwt: string;
  handle: string;
};

export function blueskyPostUrl(handle: string, rkey: string): string {
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

export function buildBlueskyPostRecord(input: {
  objectId: string;
  slug: string;
  title: string;
  summary?: string;
}): { rkey: string; record: Record<string, unknown>; permalink: string } {
  const permalink = `${SITE}/notes/${input.slug}/`;
  const post = buildBlueskyPostText({
    title: input.title,
    url: permalink,
    summary: input.summary,
  });
  const start = post.text.lastIndexOf(permalink);
  const createdAt = new Date(uuidV7TimestampMs(input.objectId)).toISOString();
  return {
    rkey: tidFromObjectId(input.objectId),
    permalink,
    record: {
      $type: 'app.bsky.feed.post',
      text: post.text,
      createdAt,
      facets: [
        {
          index: {
            byteStart: utf8Index(post.text, start),
            byteEnd: utf8Index(post.text, start + permalink.length),
          },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: permalink }],
        },
      ],
    },
  };
}

function utf8Index(text: string, index: number): number {
  return new TextEncoder().encode(text.slice(0, index)).length;
}

async function loadLocalEnv(): Promise<void> {
  const envPath = new URL('../../../.env', import.meta.url);
  let raw: string;
  try {
    raw = await readFile(envPath, 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export async function createBlueskySession(input: {
  identifier: string;
  password: string;
  fetchImpl?: typeof fetch;
}): Promise<BlueskySession> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const sessionResponse = await fetchImpl('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: input.identifier, password: input.password }),
  });
  if (!sessionResponse.ok) {
    throw new Error(`Bluesky login failed: ${await sessionResponse.text()}`);
  }
  return await sessionResponse.json() as BlueskySession;
}

export async function putBlueskyPost(input: {
  session: BlueskySession;
  objectId: string;
  slug: string;
  title: string;
  summary?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const built = buildBlueskyPostRecord(input);
  const response = await fetchImpl('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: input.session.did,
      collection: 'app.bsky.feed.post',
      rkey: built.rkey,
      record: built.record,
    }),
  });
  if (!response.ok) {
    throw new Error(`Bluesky putRecord failed: ${await response.text()}`);
  }
  return blueskyPostUrl(input.session.handle, built.rkey);
}

export async function posseNoteToBluesky(slug: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  await loadLocalEnv();
  const identifier = process.env.BLUESKY_IDENTIFIER?.trim() || 'karthikg.in';
  const password = process.env.BLUESKY_APP_PASSWORD?.trim();
  if (!password) {
    throw new Error('Set BLUESKY_APP_PASSWORD to an app password for the Bluesky account.');
  }

  const raw = await readFile(new URL(`../../content/notes/${slug}.md`, import.meta.url), 'utf8');
  const parsed = parseCanonicalNoteFile(raw);
  const publication = derivePublicationState(parsed.draft, parsed.privacyReviewed);
  if (!isPublicPublication(publication)) {
    throw new Error(`${slug} is not published. POSSE only after both publication flags are open.`);
  }

  const session = await createBlueskySession({ identifier, password, fetchImpl });
  return putBlueskyPost({
    session,
    objectId: parsed.fields.id,
    slug: parsed.fields.slug,
    title: parsed.fields.title,
    summary: parsed.fields.summary,
    fetchImpl,
  });
}
