import { describe, expect, it } from 'vitest';

import {
  deriveSlugRedirects,
  renderSlugRedirectModule,
  toAstroRedirectMap,
} from './slug-redirects.js';

describe('renderSlugRedirectModule', () => {
  it('emits a valid empty module for repositories with no history', () => {
    const source = renderSlugRedirectModule(
      deriveSlugRedirects({
        notes: [{ slug: 'first-note-probably', previousSlugs: [] }],
        projects: [{ slug: 'neighborbook', previousSlugs: [] }],
      })
    );
    expect(source).toContain('export const slugRedirects = {};');
    expect(source).toContain('AUTO-GENERATED');
  });

  it('emits a deterministic map with explicit 308 entries', () => {
    const redirects = deriveSlugRedirects({
      notes: [{ slug: 'now', previousSlugs: ['z-old', 'a-old'] }],
      projects: [{ slug: 'proj', previousSlugs: ['m-old'] }],
    });
    const source = renderSlugRedirectModule(redirects);
    const expected = toAstroRedirectMap(redirects);
    expect(source).toContain(JSON.stringify(expected, null, 2));
    expect(source).toContain('"status": 308');
    expect(source.indexOf('/notes/a-old/')).toBeLessThan(source.indexOf('/notes/z-old/'));
  });

  it('fails when fixture history collides', () => {
    expect(() =>
      deriveSlugRedirects({
        notes: [
          { slug: 'a', previousSlugs: ['shared'] },
          { slug: 'b', previousSlugs: ['shared'] },
        ],
        projects: [],
      })
    ).toThrow(/Ambiguous redirect|Duplicate redirect/);
  });
});
