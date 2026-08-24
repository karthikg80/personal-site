import { describe, expect, it } from 'vitest';

import { parseObjectId } from '../domain/ids.js';
import { validateCanonicalIdentities } from './validate-canonical-ids.js';

describe('validateCanonicalIdentities', () => {
  it('accepts migrated canonical content', () => {
    expect(() => validateCanonicalIdentities()).not.toThrow();
  });

  it('does not generate IDs for records missing id', () => {
    expect(() => parseObjectId('')).toThrow(/required/);
    expect(() => validateCanonicalIdentities()).not.toThrow();
  });
});
