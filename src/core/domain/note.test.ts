import { describe, expect, it } from 'vitest';

import { deriveNoteKind, isPublicNote, type Note } from './note.js';
import type { ObjectId } from './ids.js';
import type { Relationship } from './relationship.js';

const id = '01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5' as ObjectId;

function baseNote(overrides: Partial<Note> = {}): Note {
  return {
    id,
    slug: 'example',
    previousSlugs: [],
    title: 'Example',
    presentation: 'note',
    topics: [],
    publication: 'public',
    relationships: [],
    syndication: [],
    createdAt: new Date('2026-08-22'),
    ...overrides,
  };
}

describe('deriveNoteKind', () => {
  it('treats reply-to as reply', () => {
    const relationships: Relationship[] = [
      { type: 'reply-to', target: { kind: 'external', url: 'https://example.com/post' } },
    ];
    expect(deriveNoteKind({ presentation: 'note', relationships })).toBe('reply');
  });

  it('treats bookmark-of as bookmark', () => {
    const relationships: Relationship[] = [
      { type: 'bookmark-of', target: { kind: 'external', url: 'https://example.com/page' } },
    ];
    expect(deriveNoteKind({ presentation: 'note', relationships })).toBe('bookmark');
  });

  it('keeps scrap as presentation when not reply/bookmark', () => {
    expect(deriveNoteKind({ presentation: 'scrap', relationships: [] })).toBe('scrap');
  });

  it('defaults to note', () => {
    expect(deriveNoteKind({ presentation: 'note', relationships: [] })).toBe('note');
  });

  it('prefers reply over scrap presentation', () => {
    const relationships: Relationship[] = [
      { type: 'reply-to', target: { kind: 'external', url: 'https://example.com/post' } },
    ];
    expect(deriveNoteKind({ presentation: 'scrap', relationships })).toBe('reply');
  });

  it('prefers reply over bookmark regardless of array order', () => {
    const relationships: Relationship[] = [
      { type: 'bookmark-of', target: { kind: 'external', url: 'https://example.com/page' } },
      { type: 'reply-to', target: { kind: 'external', url: 'https://example.com/post' } },
    ];
    expect(deriveNoteKind({ presentation: 'note', relationships })).toBe('reply');
  });

  it('prefers bookmark over scrap presentation', () => {
    const relationships: Relationship[] = [
      { type: 'bookmark-of', target: { kind: 'external', url: 'https://example.com/page' } },
    ];
    expect(deriveNoteKind({ presentation: 'scrap', relationships })).toBe('bookmark');
  });
});

describe('isPublicNote', () => {
  it('follows publication state', () => {
    expect(isPublicNote(baseNote({ publication: 'public' }))).toBe(true);
    expect(isPublicNote(baseNote({ publication: 'draft' }))).toBe(false);
  });
});
