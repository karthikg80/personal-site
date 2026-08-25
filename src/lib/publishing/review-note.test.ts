import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { serializePreparedNote } from './note-markdown.js';
import { loadReviewNote, type ReviewNotesAccess } from './review-note.js';
import type { GitHubNotesConfig, NoteBlob } from './github-notes.js';

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const slug = 'building-for-the-web-of-2030';
const blobSha = '0123456789abcdef0123456789abcdef01234567';
const config: GitHubNotesConfig = {
  token: 'ghs_test',
  owner: 'karthikg80',
  repo: 'personal-site',
  branch: 'main',
};

const markdown = serializePreparedNote({
  id: objectId,
  slug,
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: ['making'],
  presentation: 'note',
  relationships: [],
  body: 'Keep this paragraph on the review page.\n',
});

function memoryNotes(seed?: { slug: string; text: string }): ReviewNotesAccess {
  const files = new Map<string, NoteBlob>();
  if (seed) files.set(seed.slug, { sha: blobSha, text: seed.text });
  return {
    getNotesConfig: () => config,
    getNoteFile: async (_config, noteSlug) => files.get(noteSlug) ?? null,
  };
}

describe('loadReviewNote', () => {
  it('loads the Git blob, future URL, publication state, and production body HTML', async () => {
    const result = await loadReviewNote(slug, memoryNotes({ slug, text: markdown }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.objectId).toBe(objectId);
    expect(result.note.slug).toBe(slug);
    expect(result.note.blobSha).toBe(blobSha);
    expect(result.note.draft).toBe(true);
    expect(result.note.privacyReviewed).toBe(true);
    expect(result.note.futureUrl).toBe(`https://karthikg.in/notes/${slug}/`);
    expect(result.note.bodyHtml).toContain('Keep this paragraph on the review page.');
    expect(result.note.canPublish).toBe(true);
    expect(result.note.data.title).toBe('Building for the web of 2030');
  });

  it('renders review HTML inertly and rewrites relative links to the future public URL', async () => {
    const active = serializePreparedNote({
      id: objectId,
      slug,
      title: 'Building for the web of 2030',
      date: '2026-08-24',
      tags: [],
      presentation: 'note',
      relationships: [],
      body: '<script>fetch("/api/drafting/publish")</script>\n[other](other)\n',
    });
    const result = await loadReviewNote(slug, memoryNotes({ slug, text: active }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.bodyHtml).not.toMatch(/<script/i);
    expect(result.note.bodyHtml).not.toContain('fetch("/api/drafting/publish")');
    expect(result.note.bodyHtml).toContain(
      'href="https://karthikg.in/notes/building-for-the-web-of-2030/other"'
    );
  });

  it('returns 404 when the Git file is missing', async () => {
    const result = await loadReviewNote(slug, memoryNotes());
    expect(result).toEqual({ ok: false, status: 404, error: 'Not found.' });
  });

  it('returns 404 when frontmatter slug does not match the route', async () => {
    const result = await loadReviewNote('other-slug', memoryNotes({ slug, text: markdown }));
    expect(result).toEqual({ ok: false, status: 404, error: 'Not found.' });
  });

  it('returns 503 when GitHub is not configured', async () => {
    const result = await loadReviewNote(slug, {
      getNotesConfig: () => null,
      getNoteFile: async () => {
        throw new Error('should not read Git');
      },
    });
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: 'Publication is not configured.',
    });
  });

  it('hides Publish when privacyReviewed is false', async () => {
    const closed = markdown.replace('privacyReviewed: true', 'privacyReviewed: false');
    const result = await loadReviewNote(slug, memoryNotes({ slug, text: closed }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.privacyReviewed).toBe(false);
    expect(result.note.canPublish).toBe(false);
  });

  it('fails clearly when the Git body uses a local Astro image', async () => {
    const withImage = serializePreparedNote({
      id: objectId,
      slug,
      title: 'Building for the web of 2030',
      date: '2026-08-24',
      tags: [],
      presentation: 'note',
      relationships: [],
      body: '![cover](./cover.png)\n',
    });
    const result = await loadReviewNote(slug, memoryNotes({ slug, text: withImage }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/local image/i);
  });
});

describe('production Note route', () => {
  it('still uses render(entry) rather than the review helper', () => {
    const source = readFileSync(join(import.meta.dirname, '../../pages/notes/[...slug].astro'), 'utf8');
    expect(source).toContain('await render(note)');
    expect(source).not.toContain('renderNoteBodyHtml');
  });

  it('is not included in the sitemap static paths', () => {
    const source = readFileSync(join(import.meta.dirname, '../../pages/sitemap.xml.ts'), 'utf8');
    expect(source).not.toContain('/drafting');
  });
});

describe('review Publish wiring', () => {
  it('posts only the three Publish fields and reloads on 409', () => {
    const page = readFileSync(
      join(import.meta.dirname, '../../pages/drafting/review/[slug].astro'),
      'utf8'
    );
    const script = readFileSync(
      join(import.meta.dirname, '../../scripts/drafting-publish.ts'),
      'utf8'
    );
    expect(page).toContain('data-publish');
    expect(page).toContain('id="review-stage-label"');
    expect(page).not.toContain('class="review-workflow"');
    expect(page).toContain('src="../../../scripts/drafting-publish.ts"');
    expect(page).toContain('Content-Security-Policy');
    expect(page).toContain("script-src 'self'");
    expect(page).toContain("base-uri 'none'");
    expect(script).toContain("fetch('/api/drafting/publish'");
    expect(script).toContain('buildPublishRequest');
    expect(script).toContain('window.location.reload()');
    expect(script).not.toMatch(/webmention|bluesky/i);
  });
});
