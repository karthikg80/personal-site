import { describe, expect, it } from 'vitest';

import { rssGuidForNote } from '../feeds/rss.js';
import { deriveSlugRedirects } from './slug-redirects.js';
import { notePathFromSlug } from './paths.js';
import { mapNote } from '../../core/storage/map-note.js';

describe('RSS rename safety with historical slugs', () => {
  it('keeps legacy GUID frozen while link path and redirect follow the new slug', () => {
    const id = '01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5';
    const legacyGuid = 'https://karthikg.in/notes/original/';
    const renamed = mapNote({
      id,
      slug: 'renamed',
      previousSlugs: ['original'],
      title: 'Renamed note',
      presentation: 'note',
      tags: [],
      draft: false,
      privacyReviewed: true,
      relationships: [],
      syndication: [],
      legacyRssGuid: legacyGuid,
      date: new Date('2026-08-22T00:00:00.000Z'),
    });

    expect(renamed.id).toBe(id);
    expect(rssGuidForNote(renamed)).toEqual({
      value: legacyGuid,
      isPermaLink: true,
    });
    expect(notePathFromSlug(renamed.slug)).toBe('/notes/renamed/');
    expect(
      deriveSlugRedirects({
        notes: [{ slug: renamed.slug, previousSlugs: renamed.previousSlugs }],
        projects: [],
      })
    ).toEqual([
      {
        source: '/notes/original/',
        destination: '/notes/renamed/',
        status: 308,
      },
    ]);
  });

  it('keeps URN GUID frozen for new notes when the slug changes', () => {
    const id = '01a03192-08ab-7445-b4a5-79d5ee7910af';
    const renamed = mapNote({
      id,
      slug: 'new-title',
      previousSlugs: ['first-title'],
      title: 'New title',
      presentation: 'note',
      tags: [],
      draft: false,
      privacyReviewed: true,
      relationships: [],
      syndication: [],
      date: new Date('2026-08-23T00:00:00.000Z'),
    });

    expect(rssGuidForNote(renamed)).toEqual({
      value: `urn:karthikg.in:note:${id}`,
      isPermaLink: false,
    });
    expect(notePathFromSlug(renamed.slug)).toBe('/notes/new-title/');
    expect(
      deriveSlugRedirects({
        notes: [{ slug: renamed.slug, previousSlugs: renamed.previousSlugs }],
        projects: [],
      })
    ).toEqual([
      {
        source: '/notes/first-title/',
        destination: '/notes/new-title/',
        status: 308,
      },
    ]);
  });
});
