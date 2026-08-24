import { describe, expect, it } from 'vitest';

import { buildHandoffMarkdown } from './handoff.js';
import { GitHubNotesError, type GitHubNotesConfig, type NoteBlob } from './github-notes.js';
import { parseCanonicalNoteFile, publishCanonicalNote, serializePreparedNote } from './note-markdown.js';
import { executePrepare, type PrepareNotesAccess } from './prepare-flow.js';

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const otherId = '018f3b2a-7c4e-7b3a-b123-456789abc000';
const slug = 'building-for-the-web-of-2030';
const config: GitHubNotesConfig = {
  token: 'ghs_test',
  owner: 'karthikg80',
  repo: 'personal-site',
  branch: 'main',
};

const valid = {
  canonicalId: objectId,
  slug,
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: [] as string[],
  presentation: 'note',
  body: 'A first public sentence.',
  privacyAcknowledgement: true as const,
};

function preparedMarkdown(overrides: Partial<typeof valid> = {}): string {
  const request = { ...valid, ...overrides };
  return serializePreparedNote({
    id: request.canonicalId,
    slug: request.slug,
    title: request.title,
    date: request.date,
    tags: request.tags,
    presentation: 'note',
    relationships: [],
    body: request.body,
  });
}

function memoryNotes(seed?: { slug: string; text: string; sha?: string }): PrepareNotesAccess & {
  files: Map<string, NoteBlob>;
  putCount: () => number;
  lastPut?: { slug: string; text: string; sha?: string };
} {
  const files = new Map<string, NoteBlob>();
  if (seed) files.set(seed.slug, { sha: seed.sha ?? 'sha-0', text: seed.text });
  let putCount = 0;
  const access: ReturnType<typeof memoryNotes> = {
    files,
    putCount: () => putCount,
    getNotesConfig: () => config,
    getNoteFile: async (_config, noteSlug) => files.get(noteSlug) ?? null,
    findNoteByObjectId: async (_config, id) => {
      for (const [fileSlug, blob] of files) {
        try {
          const parsed = parseCanonicalNoteFile(blob.text);
          if (parsed.fields.id === id) {
            return { slug: fileSlug, sha: blob.sha, text: blob.text };
          }
        } catch {
          continue;
        }
      }
      return null;
    },
    putNoteFile: async (_config, input) => {
      putCount += 1;
      const sha = `sha-${putCount}`;
      files.set(input.slug, { sha, text: input.text });
      access.lastPut = input;
      return { sha, commitSha: `commit-${putCount}` };
    },
  };
  return access;
}

describe('executePrepare', () => {
  it('creates a privacy-reviewed unpublished note', async () => {
    const notes = memoryNotes();
    const result = await executePrepare(valid, notes);
    expect(result).toMatchObject({
      ok: true,
      created: true,
      slug,
      objectId,
      blobSha: 'sha-1',
      url: `https://karthikg.in/notes/${slug}/`,
    });
    expect(notes.putCount()).toBe(1);
    expect(notes.lastPut?.text).toMatch(/^draft: true$/m);
    expect(notes.lastPut?.text).toMatch(/^privacyReviewed: true$/m);
    expect(notes.lastPut?.sha).toBeUndefined();
  });

  it('returns success without a commit when the file bytes already match', async () => {
    const text = preparedMarkdown();
    const notes = memoryNotes({ slug, text, sha: 'sha-existing' });
    const result = await executePrepare(valid, notes);
    expect(result).toMatchObject({ ok: true, created: false, blobSha: 'sha-existing' });
    expect(notes.putCount()).toBe(0);
  });

  it('updates when the body changes', async () => {
    const notes = memoryNotes({ slug, text: preparedMarkdown(), sha: 'sha-old' });
    const result = await executePrepare({ ...valid, body: 'A revised sentence.' }, notes);
    expect(result).toMatchObject({ ok: true, created: false, blobSha: 'sha-1' });
    expect(notes.putCount()).toBe(1);
    expect(notes.lastPut?.sha).toBe('sha-old');
    expect(notes.lastPut?.text).toContain('A revised sentence.');
  });

  it('upgrades a manual closed draft with the same ObjectId and slug', async () => {
    const closed = buildHandoffMarkdown({
      canonicalId: objectId,
      title: valid.title,
      slug,
      date: valid.date,
      body: valid.body,
    }).content;
    const notes = memoryNotes({ slug, text: closed, sha: 'sha-closed' });
    const result = await executePrepare(valid, notes);
    expect(result.ok).toBe(true);
    expect(notes.putCount()).toBe(1);
    expect(notes.lastPut?.text).toMatch(/^draft: true$/m);
    expect(notes.lastPut?.text).toMatch(/^privacyReviewed: true$/m);
    expect(notes.lastPut?.text).not.toMatch(/privacyReviewed: false/);
  });

  it('rejects a slug occupied by a different ObjectId', async () => {
    const notes = memoryNotes({
      slug,
      text: preparedMarkdown({ canonicalId: otherId }),
      sha: 'sha-other',
    });
    const result = await executePrepare(valid, notes);
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Slug already exists. Choose another slug.',
    });
    expect(notes.putCount()).toBe(0);
  });

  it('cannot touch a Note with draft: false', async () => {
    const published = publishCanonicalNote(preparedMarkdown());
    const notes = memoryNotes({ slug, text: published, sha: 'sha-public' });
    const result = await executePrepare(valid, notes);
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Prepare cannot modify a published Note.',
    });
    expect(notes.putCount()).toBe(0);
    expect(notes.files.get(slug)?.text).toBe(published);
  });

  it('returns 503 after validation when GitHub is not configured', async () => {
    const notes: PrepareNotesAccess = {
      getNotesConfig: () => null,
      getNoteFile: async () => {
        throw new Error('should not read Git');
      },
      findNoteByObjectId: async () => {
        throw new Error('should not scan Git');
      },
      putNoteFile: async () => {
        throw new Error('should not write Git');
      },
    };
    const result = await executePrepare(valid, notes);
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: 'Publication is not configured.',
    });
  });

  it('does not write without privacyAcknowledgement', async () => {
    const notes = memoryNotes();
    const result = await executePrepare({ ...valid, privacyAcknowledgement: false }, notes);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/Privacy acknowledgement/);
    expect(notes.putCount()).toBe(0);
  });

  it('retries create as an update when GitHub returns 422', async () => {
    const files = new Map<string, NoteBlob>();
    let puts = 0;
    const notes: PrepareNotesAccess = {
      getNotesConfig: () => config,
      getNoteFile: async (_config, noteSlug) => files.get(noteSlug) ?? null,
      findNoteByObjectId: async () => null,
      putNoteFile: async (_config, input) => {
        puts += 1;
        if (puts === 1 && !input.sha) {
          files.set(input.slug, {
            sha: 'appeared',
            text: preparedMarkdown({ body: 'A concurrent create.' }),
          });
          throw new GitHubNotesError(422, 'sha required');
        }
        files.set(input.slug, { sha: 'sha-2', text: input.text });
        return { sha: 'sha-2', commitSha: 'commit-2' };
      },
    };

    const result = await executePrepare(valid, notes);
    expect(result).toMatchObject({ ok: true, blobSha: 'sha-2' });
    expect(puts).toBe(2);
  });

  it('rejects create when the ObjectId already exists at another slug', async () => {
    const notes = memoryNotes({
      slug: 'older-slug',
      text: preparedMarkdown({ slug: 'older-slug' }),
      sha: 'sha-old',
    });
    const result = await executePrepare(valid, notes);
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'This ObjectId already exists at another path.',
    });
    expect(notes.putCount()).toBe(0);
    expect(notes.files.has(slug)).toBe(false);
  });
});
