import { describe, expect, it } from 'vitest';

import {
  derivePublicationState,
  isPublicPublication,
} from './publication.js';

describe('derivePublicationState', () => {
  it('maps draft:true to draft regardless of privacyReviewed', () => {
    expect(derivePublicationState(true, false)).toBe('draft');
    expect(derivePublicationState(true, true)).toBe('draft');
  });

  it('maps draft:false + privacyReviewed:false to awaiting-privacy-review', () => {
    expect(derivePublicationState(false, false)).toBe('awaiting-privacy-review');
  });

  it('maps draft:false + privacyReviewed:true to public', () => {
    expect(derivePublicationState(false, true)).toBe('public');
  });
});

describe('isPublicPublication', () => {
  it('is true only for public', () => {
    expect(isPublicPublication('public')).toBe(true);
    expect(isPublicPublication('draft')).toBe(false);
    expect(isPublicPublication('awaiting-privacy-review')).toBe(false);
  });
});

describe('publication invariant', () => {
  it('public iff !draft && privacyReviewed', () => {
    const cases = [
      { draft: true, privacyReviewed: true },
      { draft: true, privacyReviewed: false },
      { draft: false, privacyReviewed: false },
      { draft: false, privacyReviewed: true },
    ];
    for (const { draft, privacyReviewed } of cases) {
      const state = derivePublicationState(draft, privacyReviewed);
      const expectedPublic = !draft && privacyReviewed;
      expect(isPublicPublication(state)).toBe(expectedPublic);
    }
  });
});
