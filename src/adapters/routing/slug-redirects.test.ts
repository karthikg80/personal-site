import { describe, expect, it } from 'vitest';

import { deriveSlugRedirects, toAstroRedirectMap } from './slug-redirects.js';

describe('deriveSlugRedirects', () => {
  it('emits a note redirect with status 308', () => {
    expect(
      deriveSlugRedirects({
        notes: [{ slug: 'new-title', previousSlugs: ['old-title'] }],
        projects: [],
      })
    ).toEqual([
      {
        source: '/notes/old-title/',
        destination: '/notes/new-title/',
        status: 308,
      },
    ]);
  });

  it('emits a project redirect with status 308', () => {
    expect(
      deriveSlugRedirects({
        notes: [],
        projects: [{ slug: 'new-project', previousSlugs: ['old-project'] }],
      })
    ).toEqual([
      {
        source: '/projects/old-project/',
        destination: '/projects/new-project/',
        status: 308,
      },
    ]);
  });

  it('points every historical slug directly at the current location', () => {
    expect(
      deriveSlugRedirects({
        notes: [{ slug: 'v3', previousSlugs: ['v1', 'v2'] }],
        projects: [],
      })
    ).toEqual([
      { source: '/notes/v1/', destination: '/notes/v3/', status: 308 },
      { source: '/notes/v2/', destination: '/notes/v3/', status: 308 },
    ]);
  });

  it('produces no redirects when previousSlugs are empty', () => {
    expect(
      deriveSlugRedirects({
        notes: [{ slug: 'first-note-probably', previousSlugs: [] }],
        projects: [{ slug: 'neighborbook', previousSlugs: [] }],
      })
    ).toEqual([]);
  });

  it('allows the same bare slug across notes and projects', () => {
    expect(
      deriveSlugRedirects({
        notes: [{ slug: 'shared', previousSlugs: ['older-note'] }],
        projects: [{ slug: 'shared', previousSlugs: ['older-project'] }],
      })
    ).toEqual([
      {
        source: '/notes/older-note/',
        destination: '/notes/shared/',
        status: 308,
      },
      {
        source: '/projects/older-project/',
        destination: '/projects/shared/',
        status: 308,
      },
    ]);
  });

  it('rejects self-redirects', () => {
    expect(() =>
      deriveSlugRedirects({
        notes: [{ slug: 'foo', previousSlugs: ['foo'], label: 'note foo' }],
        projects: [],
      })
    ).toThrow(/self-redirect|must not include current slug/);
  });

  it('rejects duplicate historical routes', () => {
    expect(() =>
      deriveSlugRedirects({
        notes: [
          { slug: 'a', previousSlugs: ['old'], label: 'note a' },
          { slug: 'b', previousSlugs: ['old'], label: 'note b' },
        ],
        projects: [],
      })
    ).toThrow(/Ambiguous redirect|Duplicate redirect/);
  });

  it('rejects historical slug colliding with another current slug', () => {
    expect(() =>
      deriveSlugRedirects({
        notes: [
          { slug: 'current', previousSlugs: ['foo'], label: 'note current' },
          { slug: 'foo', previousSlugs: [], label: 'note foo' },
        ],
        projects: [],
      })
    ).toThrow(/collides with current slug/);
  });

  it('sorts redirects by source path deterministically', () => {
    const redirects = deriveSlugRedirects({
      notes: [{ slug: 'now', previousSlugs: ['z-old', 'a-old'] }],
      projects: [{ slug: 'proj', previousSlugs: ['m-old'] }],
    });
    expect(redirects.map((entry) => entry.source)).toEqual([
      '/notes/a-old/',
      '/notes/z-old/',
      '/projects/m-old/',
    ]);
  });

  it('maps to Astro redirect config with explicit 308', () => {
    const map = toAstroRedirectMap(
      deriveSlugRedirects({
        notes: [{ slug: 'new-title', previousSlugs: ['old-title'] }],
        projects: [],
      })
    );
    expect(map).toEqual({
      '/notes/old-title/': { status: 308, destination: '/notes/new-title/' },
    });
  });
});
