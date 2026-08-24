import { readFile } from 'node:fs/promises';

import { buildBlueskyPostText } from '../adapters/syndication/bluesky/post-text.js';
import { derivePublicationState, isPublicPublication } from '../core/domain/publication.js';

const SITE = 'https://karthikg.in';

async function loadLocalEnv(): Promise<void> {
  const envPath = new URL('../../.env', import.meta.url);
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

type Session = {
  did: string;
  accessJwt: string;
  handle: string;
};

function parseFrontmatter(raw: string): { title?: string; summary?: string; draft?: boolean; privacyReviewed?: boolean } {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    data[key.trim()] = rest.join(':').trim().replace(/^['"]|['"]$/g, '');
  }

  return {
    title: data.title,
    summary: data.summary,
    draft: data.draft === 'true',
    privacyReviewed: data.privacyReviewed === 'true',
  };
}

function utf8Index(text: string, index: number): number {
  return new TextEncoder().encode(text.slice(0, index)).length;
}

async function main(): Promise<void> {
  await loadLocalEnv();
  const slug = process.argv[2]?.replace(/\.md$/, '');
  if (!slug) {
    console.error('Usage: npm run posse:bluesky -- <note-slug>');
    process.exit(1);
  }

  const identifier = process.env.BLUESKY_IDENTIFIER?.trim() || 'karthikg.in';
  const password = process.env.BLUESKY_APP_PASSWORD?.trim();
  if (!password) {
    console.error('Set BLUESKY_APP_PASSWORD to an app password for the Bluesky account.');
    process.exit(1);
  }

  const raw = await readFile(new URL(`../../src/content/notes/${slug}.md`, import.meta.url), 'utf8');
  const note = parseFrontmatter(raw);
  const publication = derivePublicationState(note.draft === true, note.privacyReviewed === true);
  if (!isPublicPublication(publication)) {
    console.error(`${slug} is not published. POSSE only after both publication flags are open.`);
    process.exit(1);
  }

  const url = `${SITE}/notes/${slug}/`;
  const post = buildBlueskyPostText({
    title: note.title ?? slug,
    url,
    summary: note.summary,
  });
  const start = post.text.lastIndexOf(url);
  const record = {
    $type: 'app.bsky.feed.post',
    text: post.text,
    createdAt: new Date().toISOString(),
    facets: [
      {
        index: {
          byteStart: utf8Index(post.text, start),
          byteEnd: utf8Index(post.text, start + url.length),
        },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      },
    ],
  };

  const sessionResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!sessionResponse.ok) {
    console.error('Bluesky login failed.', await sessionResponse.text());
    process.exit(1);
  }

  const session = await sessionResponse.json() as Session;
  const created = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });

  if (!created.ok) {
    console.error('Bluesky post failed.', await created.text());
    process.exit(1);
  }

  const result = await created.json() as { uri: string };
  const rkey = result.uri.split('/').pop();
  const publicUrl = `https://bsky.app/profile/${session.handle}/post/${rkey}`;

  console.log(publicUrl);
  console.log(`Add this to the note frontmatter:\n\nsyndication:\n  - ${publicUrl}`);
}

await main();
