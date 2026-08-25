import { describe, expect, it } from 'vitest';

import { tidFromObjectId, uuidV7ClockId, uuidV7TimestampMs } from './tid.js';

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const otherSameMs = '018f3b2a-7c4e-7fff-8123-456789abcdef';

describe('tidFromObjectId', () => {
  it('is a deterministic 13-character TID, not the raw UUID', () => {
    const tid = tidFromObjectId(objectId);
    expect(tid).toHaveLength(13);
    expect(tid).toMatch(/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);
    expect(tid).not.toContain('-');
    expect(tidFromObjectId(objectId)).toBe(tid);
  });

  it('changes when the UUIDv7 clock bits change', () => {
    expect(uuidV7TimestampMs(objectId)).toBe(uuidV7TimestampMs(otherSameMs));
    expect(uuidV7ClockId(objectId)).not.toBe(uuidV7ClockId(otherSameMs));
    expect(tidFromObjectId(objectId)).not.toBe(tidFromObjectId(otherSameMs));
  });
});
