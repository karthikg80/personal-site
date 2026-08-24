import { describe, expect, it } from 'vitest';
import { validate as validateUuid, version as uuidVersion } from 'uuid';

import { generateObjectId } from './generate-object-id.js';
import { parseObjectIdV7 } from '../domain/ids.js';

describe('generateObjectId', () => {
  it('returns a valid UUIDv7', () => {
    const id = generateObjectId();
    expect(validateUuid(id)).toBe(true);
    expect(uuidVersion(id)).toBe(7);
    expect(parseObjectIdV7(id)).toBe(id);
  });

  it('returns distinct values', () => {
    const a = generateObjectId();
    const b = generateObjectId();
    expect(a).not.toBe(b);
  });
});
