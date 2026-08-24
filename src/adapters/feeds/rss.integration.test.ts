import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { mapNote } from '../../core/storage/map-note.js';
import { rssGuidForNote } from './rss.js';

describe('rss legacy compatibility', () => {
  it('emits exact legacyRssGuid values for legacy notes in repository content', () => {
    const raw = readFileSync(
      join(import.meta.dirname, '../../content/notes/first-note-probably.md'),
      'utf8'
    );
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) throw new Error('missing frontmatter');
    const data = parseYaml(match[1]) as Parameters<typeof mapNote>[0];
    const note = mapNote({
      ...data,
      date: new Date(data.date),
      updated: data.updated ? new Date(data.updated) : undefined,
    });

    expect(note.legacyRssGuid).toBe('https://karthikg.in/notes/first-note-probably/');
    const guid = rssGuidForNote(note);
    expect(guid.value).toBe(note.legacyRssGuid);
    expect(guid.isPermaLink).toBe(true);
  });

  it('does not require legacyRssGuid to produce GUID for new notes', () => {
    const note = mapNote({
      id: '01a03192-08ab-7445-b4a5-79d5ee7910af',
      slug: 'new-note',
      previousSlugs: [],
      title: 'New note',
      presentation: 'note',
      tags: [],
      draft: false,
      privacyReviewed: true,
      syndication: [],
      date: new Date('2026-08-23T00:00:00.000Z'),
    });
    const guid = rssGuidForNote(note);
    expect(guid).toEqual({
      value: 'urn:karthikg.in:note:01a03192-08ab-7445-b4a5-79d5ee7910af',
      isPermaLink: false,
    });
  });

  it('legacy note guid matches historical feed identity for first-note-probably', () => {
    const historical = 'https://karthikg.in/notes/first-note-probably/';
    const note = mapNote({
      id: '01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5',
      slug: 'first-note-probably',
      previousSlugs: [],
      title: 'First note, probably',
      presentation: 'scrap',
      tags: ['making', 'personal web'],
      draft: false,
      privacyReviewed: true,
      syndication: ['https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a'],
      legacyRssGuid: historical,
      date: new Date('2026-08-22T00:00:00.000Z'),
    });
    expect(rssGuidForNote(note)).toEqual({
      value: historical,
      isPermaLink: true,
    });
  });
});
