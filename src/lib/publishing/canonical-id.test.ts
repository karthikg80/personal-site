import { describe, expect, it } from 'vitest';
import { version as uuidVersion } from 'uuid';

import { ensureCanonicalId } from './canonical-id.js';
import { parseObjectIdV7 } from '../../core/domain/ids.js';

describe('ensureCanonicalId', () => {
  it('returns an existing UUIDv7 unchanged', () => {
    const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
    expect(ensureCanonicalId(id)).toBe(id);
  });

  it('assigns a UUIDv7 when missing', () => {
    const id = ensureCanonicalId(undefined);
    expect(uuidVersion(id)).toBe(7);
    expect(parseObjectIdV7(id)).toBe(id);
  });

  it('rejects a UUIDv4 instead of adopting it', () => {
    expect(() => ensureCanonicalId('550e8400-e29b-41d4-a716-446655440000')).toThrow(/UUIDv7/);
  });
});
