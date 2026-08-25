import { describe, expect, it } from 'vitest';

import { parseObjectId } from '../domain/ids.js';
import {
  assertLegacyRssGuidRule,
  validateCanonicalIdentities,
} from './validate-canonical-ids.js';

describe('validateCanonicalIdentities', () => {
  it('accepts migrated canonical content', () => {
    expect(() => validateCanonicalIdentities()).not.toThrow();
  });

  it('does not generate IDs for records missing id', () => {
    expect(() => parseObjectId('')).toThrow(/required/);
    expect(() => validateCanonicalIdentities()).not.toThrow();
  });
});

describe('assertLegacyRssGuidRule', () => {
  it('allows a public note without legacyRssGuid (new notes use URN GUIDs)', () => {
    expect(() =>
      assertLegacyRssGuidRule({
        isPublic: true,
        slug: 'building-for-the-web-of-2030',
        previousSlugs: [],
      })
    ).not.toThrow();
  });

  it('still requires a karthikg.in notes URL when legacyRssGuid is present', () => {
    expect(() =>
      assertLegacyRssGuidRule({
        isPublic: true,
        slug: 'first-note-probably',
        previousSlugs: [],
        legacyRssGuid: 'https://example.com/nope',
      })
    ).toThrow(/legacyRssGuid/);
  });

  it('forbids legacyRssGuid on non-public notes', () => {
    expect(() =>
      assertLegacyRssGuidRule({
        isPublic: false,
        slug: 'wip',
        previousSlugs: [],
        legacyRssGuid: 'https://karthikg.in/notes/wip/',
      })
    ).toThrow(/only allowed on public notes/);
  });
});
