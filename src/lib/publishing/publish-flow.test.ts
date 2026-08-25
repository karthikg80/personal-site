import { describe, expect, it } from 'vitest';

import { buildHandoffMarkdown } from './handoff.js';
import type { GitHubNotesConfig, NoteBlob, RecoveredNoteFile } from './github-notes.js';
import { parseCanonicalNoteFile, publishCanonicalNote, serializePreparedNote } from './note-markdown.js';
import {
  executeCanonicalLookup,
  executePublish,
  type PublishNotesAccess,
} from './publish-flow.js';

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const otherId = '018f3b2a-7c4e-7b3a-b123-456789abc000';
const slug = 'building-for-the-web-of-2030';
const blobSha = '0123456789abcdef0123456789abcdef01234567';
const staleSha = 'abcdef0123456789abcdef0123456789abcdef01';
const config: GitHubNotesConfig = {
  token: 'ghs_test',
  owner: 'karthikg80',
  repo: 'personal-site',
  branch: 'main',
};

const body = 'Keep this paragraph identical through Publish.\n';

const prepared = serializePreparedNote({
  id: objectId,
  slug,
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: ['making'],
  presentation: 'note',
  relationships: [
    {
      type: 'reply-to',
      target: { kind: 'external', url: 'https://example.com/post' },
    },
  ],
  body,
});

const publishRequest = {
  objectId,
  slug,
  expectedBlobSha: blobSha,
};

function memoryNotes(seed?: { slug: string; text: string; sha?: string }): PublishNotesAccess & {
  files: Map<string, NoteBlob>;
  putCount: () => number;
  lastPut?: { slug: string; text: string; sha?: string };
} {
  const files = new Map<string, NoteBlob>();
  if (seed) files.set(seed.slug, { sha: seed.sha ?? blobSha, text: seed.text });
  let putCount = 0;
  const access: ReturnType<typeof memoryNotes> = {
    files,
    putCount: () => putCount,
    getNotesConfig: () => config,
    getNoteFile: async (_config, noteSlug) => files.get(noteSlug) ?? null,
    putNoteFile: async (_config, input) => {
      putCount += 1;
      const sha = `1${blobSha.slice(1)}`;
      files.set(input.slug, { sha, text: input.text });
      access.lastPut = input;
      return { sha, commitSha: `c${blobSha.slice(1)}` };
    },
    recoverNoteFile: async (_config, input) => {
      if (!input.slug) return null;
      const file = files.get(input.slug);
      if (!file) return null;
      const parsed = parseCanonicalNoteFile(file.text);
      if (parsed.fields.id !== input.objectId) return null;
      return { slug: input.slug, sha: file.sha, text: file.text } satisfies RecoveredNoteFile;
    },
  };
  return access;
}

describe('executePublish', () => {
  it('returns 409 and does not alter the file when the blob SHA is stale', async () => {
    const notes = memoryNotes({ slug, text: prepared, sha: blobSha });
    const result = await executePublish({ ...publishRequest, expectedBlobSha: staleSha }, notes);
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'The canonical file changed. Reload and try again.',
    });
    expect(notes.putCount()).toBe(0);
    expect(notes.files.get(slug)?.text).toBe(prepared);
  });

  it('refuses to publish an unreviewed file', async () => {
    const closed = buildHandoffMarkdown({
      canonicalId: objectId,
      title: 'Building for the web of 2030',
      slug,
      date: '2026-08-24',
      body,
    }).content;
    const notes = memoryNotes({ slug, text: closed, sha: blobSha });
    const result = await executePublish(publishRequest, notes);
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'This canonical Note is not privacy-reviewed.',
    });
    expect(notes.putCount()).toBe(0);
  });

  it('is idempotent when the Note is already public', async () => {
    const published = publishCanonicalNote(prepared);
    const notes = memoryNotes({ slug, text: published, sha: blobSha });
    const result = await executePublish(publishRequest, notes);
    expect(result).toMatchObject({ ok: true, slug, objectId, blobSha });
    expect(notes.putCount()).toBe(0);
  });

  it('flips only draft and leaves identity, body, relationships, and syndication intact', async () => {
    const before = parseCanonicalNoteFile(prepared);
    const notes = memoryNotes({ slug, text: prepared, sha: blobSha });
    const result = await executePublish(publishRequest, notes);

    expect(result).toMatchObject({
      ok: true,
      slug,
      objectId,
      url: `https://karthikg.in/notes/${slug}/`,
    });
    expect(notes.putCount()).toBe(1);
    expect(notes.lastPut?.sha).toBe(blobSha);

    const putText = notes.lastPut!.text;
    expect(putText).toMatch(/^draft: false$/m);
    expect(putText).toMatch(/^privacyReviewed: true$/m);
    expect(putText).toContain('Keep this paragraph identical through Publish.');
    expect(putText).not.toMatch(/^draft: true$/m);

    const after = parseCanonicalNoteFile(putText);
    expect(after.draft).toBe(false);
    expect(after.privacyReviewed).toBe(true);
    expect(after.fields.id).toBe(before.fields.id);
    expect(after.fields.slug).toBe(before.fields.slug);
    expect(after.body).toBe(before.body);
    expect(after.fields.relationships).toEqual(before.fields.relationships);
    expect(after.fields.title).toBe(before.fields.title);
    expect(putText).toMatch(/^syndication: \[\]$/m);
  });

  it('rejects privacyAcknowledgement on Publish', async () => {
    const notes = memoryNotes({ slug, text: prepared, sha: blobSha });
    const result = await executePublish({ ...publishRequest, privacyAcknowledgement: true }, notes);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(notes.putCount()).toBe(0);
  });

  it('returns 404 when the file is missing', async () => {
    const notes = memoryNotes();
    const result = await executePublish(publishRequest, notes);
    expect(result).toEqual({ ok: false, status: 404, error: 'Canonical Note not found.' });
  });

  it('returns 409 when ObjectId does not match the file', async () => {
    const notes = memoryNotes({ slug, text: prepared, sha: blobSha });
    const result = await executePublish({ ...publishRequest, objectId: otherId }, notes);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(notes.putCount()).toBe(0);
  });
});

describe('executeCanonicalLookup', () => {
  it('returns the Git file identity without requiring Origin', async () => {
    const notes = memoryNotes({ slug, text: prepared, sha: blobSha });
    const result = await executeCanonicalLookup(objectId, slug, notes);
    expect(result).toEqual({
      ok: true,
      id: objectId,
      slug,
      draft: true,
      privacyReviewed: true,
      sha: blobSha,
      url: `https://karthikg.in/notes/${slug}/`,
    });
  });

  it('returns 404 when recovery finds nothing', async () => {
    const notes = memoryNotes();
    const result = await executeCanonicalLookup(objectId, slug, notes);
    expect(result).toEqual({ ok: false, status: 404, error: 'Canonical Note not found.' });
  });
});
