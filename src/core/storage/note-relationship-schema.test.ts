import { describe, expect, it } from 'vitest';

import { noteRelationshipSchema } from './note-relationship-schema.js';

describe('noteRelationshipSchema', () => {
  it('accepts an empty relationships array', () => {
    expect(noteRelationshipSchema.parse([])).toEqual([]);
  });

  it('defaults missing relationships to an empty array', () => {
    expect(noteRelationshipSchema.parse(undefined)).toEqual([]);
  });

  it('accepts reply-to and bookmark-of external targets', () => {
    expect(
      noteRelationshipSchema.parse([
        {
          type: 'reply-to',
          target: { kind: 'external', url: 'https://example.com/post' },
        },
        {
          type: 'bookmark-of',
          target: { kind: 'external', url: 'https://example.com/saved' },
        },
      ])
    ).toEqual([
      {
        type: 'reply-to',
        target: { kind: 'external', url: 'https://example.com/post' },
      },
      {
        type: 'bookmark-of',
        target: { kind: 'external', url: 'https://example.com/saved' },
      },
    ]);
  });

  it('rejects an invalid relationship type', () => {
    const result = noteRelationshipSchema.safeParse([
      {
        type: 'related-to',
        target: { kind: 'external', url: 'https://example.com/post' },
      },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid external URL', () => {
    const result = noteRelationshipSchema.safeParse([
      {
        type: 'reply-to',
        target: { kind: 'external', url: 'not-a-url' },
      },
    ]);
    expect(result.success).toBe(false);
  });
});
