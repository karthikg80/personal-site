import { describe, expect, it } from 'vitest';

import { parseObjectId } from '../../core/domain/ids.js';
import type { Note } from '../../core/domain/note.js';
import { rssGuidForNote } from './rss.js';

function baseNote(overrides: Partial<Note> = {}): Note {
  return {
    id: parseObjectId('01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5'),
    slug: 'example',
    previousSlugs: [],
    title: 'Example',
    presentation: 'note',
    topics: [],
    publication: 'public',
    relationships: [],
    syndication: [],
    createdAt: new Date('2026-08-22T00:00:00.000Z'),
    ...overrides,
  };
}

describe('rssGuidForNote', () => {
  it('uses frozen legacyRssGuid with isPermaLink=true', () => {
    const note = baseNote({
      legacyRssGuid: 'https://karthikg.in/notes/first-note-probably/',
    });

    expect(rssGuidForNote(note)).toEqual({
      value: 'https://karthikg.in/notes/first-note-probably/',
      isPermaLink: true,
    });
  });

  it('uses urn from object id for new notes with isPermaLink=false', () => {
    const note = baseNote({
      id: parseObjectId('01a03192-08ab-7445-b4a5-79d5ee7910af'),
      legacyRssGuid: undefined,
    });

    expect(rssGuidForNote(note)).toEqual({
      value: 'urn:karthikg.in:note:01a03192-08ab-7445-b4a5-79d5ee7910af',
      isPermaLink: false,
    });
  });

  it('is slug-independent for new notes', () => {
    const id = parseObjectId('01a03192-08ab-7445-b4a5-79d5ee7910af');
    const oldSlug = baseNote({ id, slug: 'old-name', legacyRssGuid: undefined });
    const newSlug = baseNote({ id, slug: 'new-name', legacyRssGuid: undefined });

    expect(rssGuidForNote(oldSlug)).toEqual(rssGuidForNote(newSlug));
  });

  it('is slug-independent for legacy notes with frozen guid', () => {
    const frozen = 'https://karthikg.in/notes/first-note-probably/';
    const oldSlug = baseNote({ slug: 'old-name', legacyRssGuid: frozen });
    const newSlug = baseNote({ slug: 'new-name', legacyRssGuid: frozen });

    expect(rssGuidForNote(oldSlug)).toEqual(rssGuidForNote(newSlug));
  });
});
