import { describe, expect, it } from 'vitest';

import { mapNote } from '../../core/storage/map-note.js';
import {
  parseCanonicalNoteFile,
  publishCanonicalNote,
  serializePreparedNote,
  type CanonicalNoteFields,
} from './note-markdown.js';

const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef';

const fields: CanonicalNoteFields = {
  id,
  slug: 'building-for-the-web-of-2030',
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
  body: 'The body must survive the round trip.\n\nSecond paragraph.\n',
};

function frontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error('Expected YAML frontmatter');
  }
  return match[1]!;
}

describe('serializePreparedNote', () => {
  it('always writes unpublished privacy-reviewed gates', () => {
    const markdown = serializePreparedNote(fields);
    const yaml = frontmatter(markdown);
    expect(yaml).toMatch(/^draft: true$/m);
    expect(yaml).toMatch(/^privacyReviewed: true$/m);
    expect(yaml).not.toMatch(/legacyRssGuid/);
    expect(yaml).toMatch(/^previousSlugs: \[\]$/m);
    expect(yaml).toMatch(/^syndication: \[\]$/m);
    expect(yaml).toContain('webmentions: false');
    expect(yaml).toContain('bluesky: false');
  });

  it('preserves the Markdown body after the second fence', () => {
    const markdown = serializePreparedNote(fields);
    const parsed = parseCanonicalNoteFile(markdown);
    expect(parsed.body).toBe(fields.body);
  });

  it('round-trips through mapNote', () => {
    const markdown = serializePreparedNote(fields);
    const parsed = parseCanonicalNoteFile(markdown);
    const note = mapNote({
      id: parsed.fields.id,
      slug: parsed.fields.slug,
      previousSlugs: [],
      title: parsed.fields.title,
      presentation: parsed.fields.presentation,
      tags: parsed.fields.tags,
      draft: parsed.draft,
      privacyReviewed: parsed.privacyReviewed,
      relationships: parsed.fields.relationships,
      syndication: [],
      date: new Date(`${parsed.fields.date}T00:00:00.000Z`),
    });
    expect(note.id).toBe(id);
    expect(note.slug).toBe(fields.slug);
    expect(note.title).toBe(fields.title);
    expect(note.publication).toBe('draft');
    expect(note.relationships).toEqual(fields.relationships);
    expect(note.topics).toEqual(['making']);
    expect(note.legacyRssGuid).toBeUndefined();
  });

  it('omits empty summary', () => {
    const markdown = serializePreparedNote(fields);
    expect(frontmatter(markdown)).not.toMatch(/summary:/);
  });
});

describe('publishCanonicalNote', () => {
  it('flips only draft on a privacy-reviewed unpublished note', () => {
    const prepared = serializePreparedNote(fields);
    const published = publishCanonicalNote(prepared);
    const parsed = parseCanonicalNoteFile(published);
    expect(parsed.draft).toBe(false);
    expect(parsed.privacyReviewed).toBe(true);
    expect(parsed.fields.id).toBe(id);
    expect(parsed.fields.slug).toBe(fields.slug);
    expect(parsed.fields.relationships).toEqual(fields.relationships);
    expect(parsed.body).toBe(fields.body);
    expect(frontmatter(published)).toMatch(/^syndication: \[\]$/m);
    expect(frontmatter(published)).toContain('webmentions: false');
    expect(published).not.toMatch(/privacyReviewed: false/);
  });

  it('refuses an unreviewed file', () => {
    const unreviewed = serializePreparedNote(fields).replace(
      'privacyReviewed: true',
      'privacyReviewed: false'
    );
    expect(() => publishCanonicalNote(unreviewed)).toThrow(/privacyReviewed/);
  });

  it('preserves distribution intent; Publish still flips only draft', () => {
    const prepared = serializePreparedNote({
      ...fields,
      distribution: { webmentions: true, bluesky: true },
    });
    expect(frontmatter(prepared)).toContain('webmentions: true');
    expect(frontmatter(prepared)).toContain('bluesky: true');
    const published = publishCanonicalNote(prepared);
    expect(parseCanonicalNoteFile(published).draft).toBe(false);
    expect(frontmatter(published)).toContain('webmentions: true');
    expect(frontmatter(published)).toContain('bluesky: true');
    expect(frontmatter(published)).toMatch(/^draft: false$/m);
  });

  it('refuses a file that is already public', () => {
    const prepared = serializePreparedNote(fields);
    const published = publishCanonicalNote(prepared);
    expect(() => publishCanonicalNote(published)).toThrow(/already public/);
  });
});
