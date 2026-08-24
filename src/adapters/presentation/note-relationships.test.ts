import { describe, expect, it } from 'vitest';

import { parseObjectId } from '../../core/domain/ids.js';
import type { Note } from '../../core/domain/note.js';
import {
  externalBookmarkUrl,
  externalReplyUrl,
  relationshipMicroformatClass,
} from './note-relationships.js';

const baseNote: Note = {
  id: parseObjectId('01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5'),
  slug: 'example',
  previousSlugs: [],
  title: 'Example',
  presentation: 'note',
  topics: [],
  publication: 'public',
  relationships: [],
  syndication: [],
  createdAt: new Date('2026-08-22'),
};

describe('note relationship presentation projection', () => {
  it('maps reply-to to u-in-reply-to and bookmark-of to u-bookmark-of', () => {
    expect(relationshipMicroformatClass('reply-to')).toBe('u-in-reply-to');
    expect(relationshipMicroformatClass('bookmark-of')).toBe('u-bookmark-of');
  });

  it('projects reply-to to an external URL for u-in-reply-to', () => {
    expect(
      externalReplyUrl({
        ...baseNote,
        relationships: [
          {
            type: 'reply-to',
            target: { kind: 'external', url: 'https://example.com/post' },
          },
        ],
      })
    ).toBe('https://example.com/post');
  });

  it('projects bookmark-of to an external URL for u-bookmark-of', () => {
    expect(
      externalBookmarkUrl({
        ...baseNote,
        relationships: [
          {
            type: 'bookmark-of',
            target: { kind: 'external', url: 'https://example.com/page' },
          },
        ],
      })
    ).toBe('https://example.com/page');
  });

  it('returns undefined when relationships are empty', () => {
    expect(externalReplyUrl(baseNote)).toBeUndefined();
    expect(externalBookmarkUrl(baseNote)).toBeUndefined();
  });
});
