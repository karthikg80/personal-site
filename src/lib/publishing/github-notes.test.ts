import { afterEach, describe, expect, it, vi } from 'vitest';

import { serializePreparedNote } from './note-markdown.js';
import {
  findNoteByObjectId,
  getNoteFile,
  getNotesConfig,
  GitHubNotesError,
  putNoteFile,
  recoverNoteFile,
  type GitHubNotesConfig,
} from './github-notes.js';

const config: GitHubNotesConfig = {
  token: 'ghs_test_token',
  owner: 'karthikg80',
  repo: 'personal-site',
  branch: 'main',
};

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const slug = 'building-for-the-web-of-2030';
const markdown = serializePreparedNote({
  id: objectId,
  slug,
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: [],
  presentation: 'note',
  relationships: [],
  body: 'Hello from Git.\n',
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

function mockFetch(impl: typeof fetch) {
  return vi.fn<typeof fetch>(impl);
}

function fetchCall(
  fetchMock: ReturnType<typeof mockFetch>,
  index = 0
): { url: string; init?: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call?.[0]) {
    throw new Error(`Expected fetch to have been called at index ${index}`);
  }
  return { url: String(call[0]), init: call[1] };
}

describe('getNotesConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null without GITHUB_NOTES_TOKEN', () => {
    vi.stubEnv('GITHUB_NOTES_TOKEN', '');
    expect(getNotesConfig()).toBeNull();
  });

  it('defaults owner, repo, and branch', () => {
    vi.stubEnv('GITHUB_NOTES_TOKEN', 'ghs_live');
    expect(getNotesConfig()).toEqual({
      token: 'ghs_live',
      owner: 'karthikg80',
      repo: 'personal-site',
      branch: 'main',
    });
  });
});

describe('GitHub notes Contents client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when the note file is missing', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(404, { message: 'Not Found' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNoteFile(config, slug)).resolves.toBeNull();
  });

  it('decodes a note file blob', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(200, filePayload(markdown, 'abc123')));
    vi.stubGlobal('fetch', fetchMock);

    const file = await getNoteFile(config, slug);
    expect(file).toEqual({ sha: 'abc123', text: markdown });
    const url = fetchCall(fetchMock).url;
    expect(url).toContain('/contents/src/content/notes/building-for-the-web-of-2030.md');
    expect(url).toContain('ref=main');
  });

  it('puts only the path derived from the slug', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(200, {
        content: { sha: 'newblob' },
        commit: { sha: 'newcommit' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await putNoteFile(config, {
      slug,
      text: markdown,
      message: `draft(note): prepare ${slug}`,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const { url, init } = fetchCall(fetchMock);
    expect(url).toBe(
      'https://api.github.com/repos/karthikg80/personal-site/contents/src/content/notes/building-for-the-web-of-2030.md'
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      message: `draft(note): prepare ${slug}`,
      branch: 'main',
      content: Buffer.from(markdown, 'utf8').toString('base64'),
    });
    expect(url).not.toContain('README');
  });

  it('does not scan the notes directory when recovering with a slug', async () => {
    const fetchMock = mockFetch(async (url) => {
      if (String(url).includes('?ref=') && String(url).endsWith('.md?ref=main')) {
        return jsonResponse(200, filePayload(markdown, 'abc123'));
      }
      return jsonResponse(500, { message: 'unexpected directory list' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const recovered = await recoverNoteFile(config, { objectId, slug });
    expect(recovered).toEqual({ slug, sha: 'abc123', text: markdown });
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes(`${slug}.md`))).toBe(true);
  });

  it('scans the notes directory only when slug is missing', async () => {
    const fetchMock = mockFetch(async (url) => {
      const href = String(url);
      if (href.endsWith('/contents/src/content/notes?ref=main')) {
        return jsonResponse(200, [
          { name: `${slug}.md`, type: 'file', path: `src/content/notes/${slug}.md` },
        ]);
      }
      if (href.includes(`${slug}.md`)) {
        return jsonResponse(200, filePayload(markdown, 'scan-sha'));
      }
      return jsonResponse(404, { message: 'Not Found' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const recovered = await recoverNoteFile(config, { objectId });
    expect(recovered).toEqual({ slug, sha: 'scan-sha', text: markdown });
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).endsWith('/contents/src/content/notes?ref=main'))
    ).toBe(true);
  });

  it('throws GitHubNotesError with status on unexpected failures', async () => {
    vi.stubGlobal('fetch', mockFetch(async () => jsonResponse(401, { message: 'Bad credentials' })));
    await expect(getNoteFile(config, slug)).rejects.toBeInstanceOf(GitHubNotesError);
    await expect(getNoteFile(config, slug)).rejects.toMatchObject({ status: 401 });
  });
});

describe('findNoteByObjectId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is available as an explicit scan, not the default recovery path', async () => {
    const fetchMock = mockFetch(async (url) => {
      const href = String(url);
      if (href.endsWith('/contents/src/content/notes?ref=main')) {
        return jsonResponse(200, [
          { name: `${slug}.md`, type: 'file', path: `src/content/notes/${slug}.md` },
        ]);
      }
      return jsonResponse(200, filePayload(markdown, 'found'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(findNoteByObjectId(config, objectId)).resolves.toMatchObject({ slug, sha: 'found' });
  });
});
