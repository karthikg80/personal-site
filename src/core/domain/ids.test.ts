import { describe, expect, it } from 'vitest';

import { assertUniqueObjectIds, isUuidShape, parseObjectId, parseObjectIdV7 } from './ids.js';

describe('parseObjectId', () => {
  it('accepts a valid UUID', () => {
    const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
    expect(parseObjectId(id)).toBe(id);
    expect(isUuidShape(id)).toBe(true);
  });

  it('rejects invalid UUID strings', () => {
    expect(() => parseObjectId('not-a-uuid')).toThrow(/Invalid ObjectId/);
    expect(() => parseObjectId('')).toThrow(/required/);
    expect(isUuidShape('not-a-uuid')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(() => parseObjectId('018f3b2a-7c4e-7b3a-b123')).toThrow(/Invalid ObjectId/);
  });
});

describe('parseObjectIdV7', () => {
  it('accepts UUIDv7', () => {
    const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
    expect(parseObjectIdV7(id)).toBe(id);
  });

  it('rejects non-v7 UUIDs', () => {
    const v4 = '550e8400-e29b-41d4-a716-446655440000';
    expect(() => parseObjectIdV7(v4)).toThrow(/UUIDv7/);
  });
});

describe('assertUniqueObjectIds', () => {
  it('passes for unique ids', () => {
    expect(() =>
      assertUniqueObjectIds([
        '018f3b2a-7c4e-7b3a-b123-456789abcdef' as const,
        '018f3b2a-8d11-7b3a-b123-456789abcdef' as const,
      ])
    ).not.toThrow();
  });

  it('fails on duplicates', () => {
    const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef' as const;
    expect(() => assertUniqueObjectIds([id, id])).toThrow(/Duplicate ObjectId/);
  });
});
