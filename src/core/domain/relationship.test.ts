import { describe, expect, it } from 'vitest';

import { parseObjectId } from './ids.js';
import {
  externalRelationshipUrls,
  findRelationship,
  type Relationship,
} from './relationship.js';

describe('relationship helpers', () => {
  const relationships: Relationship[] = [
    {
      type: 'bookmark-of',
      target: { kind: 'external', url: 'https://example.com/page' },
    },
    {
      type: 'reply-to',
      target: { kind: 'external', url: 'https://example.com/post' },
    },
    {
      type: 'reply-to',
      target: {
        kind: 'internal',
        id: parseObjectId('01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5'),
      },
    },
  ];

  it('finds the first relationship of a type', () => {
    expect(findRelationship(relationships, 'reply-to')?.target).toEqual({
      kind: 'external',
      url: 'https://example.com/post',
    });
  });

  it('extracts only external relationship URLs', () => {
    expect(externalRelationshipUrls(relationships)).toEqual([
      'https://example.com/page',
      'https://example.com/post',
    ]);
  });
});
