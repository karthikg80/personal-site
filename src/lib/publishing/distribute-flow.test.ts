import { afterEach, describe, expect, it, vi } from 'vitest';

import { appendSyndicationUrl } from './distribution.js';
import { commitSyndicationUrl, productionEnvironment, runDistributePublishedNote } from './distribute-flow.js';
import { serializePreparedNote } from './note-markdown.js';
import type { GitHubNotesConfig } from './github-notes.js';

const config: GitHubNotesConfig = {
  token: 'ghs_test_token',
  owner: 'karthikg80',
  repo: 'personal-site',
  branch: 'main',
};

const slug = 'building-for-the-web-of-2030';
const blueskyUrl = 'https://bsky.app/profile/karthikg.in/post/3abc';
const markdown = serializePreparedNote({
  id: '018f3b2a-7c4e-7b3a-b123-456789abcdef',
  slug,
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: [],
  presentation: 'note',
  relationships: [],
  body: 'Hello.\n',
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function filePayload(text: string, sha = 'blobsha1') {
  return {
    sha,
    encoding: 'base64',
    content: Buffer.from(text, 'utf8').toString('base64'),
  };
}

describe('productionEnvironment', () => {
  it('accepts production and omitted environment, rejects preview', () => {
    expect(productionEnvironment({ environment: 'production' })).toBe(true);
    expect(productionEnvironment({ git: { sha: 'a'.repeat(40) } })).toBe(true);
    expect(productionEnvironment({ environment: 'preview' })).toBe(false);
  });
});

describe('runDistributePublishedNote', () => {
  it('returns without scanning git when the promotion is not production', async () => {
    await expect(runDistributePublishedNote({
      payload: {
        environment: 'preview',
        git: { sha: 'abcdef1234567890abcdef1234567890abcdef12' },
      },
    })).resolves.toBeUndefined();
  });
});

describe('commitSyndicationUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats a stale SHA as success when the URL is already present', async () => {
    const withUrl = appendSyndicationUrl(markdown, blueskyUrl).text;
    let gets = 0;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === 'PUT') {
        return jsonResponse(409, { message: 'sha mismatch' });
      }
      gets += 1;
      return jsonResponse(200, filePayload(gets === 1 ? markdown : withUrl, gets === 1 ? 'old' : 'newer'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(commitSyndicationUrl({ config, slug, url: blueskyUrl })).resolves.toBe(false);
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true);
  });
});
