import { describe, expect, it } from 'vitest';

import { mapNote } from './map-note.js';
import { mapProject } from './map-project.js';
import { mapPerson } from './map-person.js';

describe('mapNote', () => {
  const base = {
    id: '01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5',
    slug: 'first-note-probably',
    previousSlugs: [] as string[],
    title: 'First note, probably',
    summary: 'A summary',
    presentation: 'scrap' as const,
    tags: ['making', 'personal web'],
    draft: false,
    privacyReviewed: true,
    syndication: ['https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a'],
    legacyRssGuid: 'https://karthikg.in/notes/first-note-probably/',
    date: new Date('2026-08-22T00:00:00.000Z'),
  };

  it('preserves identity, slug, topics, syndication, and legacyRssGuid', () => {
    const note = mapNote(base);
    expect(note.id).toBe(base.id);
    expect(note.slug).toBe('first-note-probably');
    expect(note.previousSlugs).toEqual([]);
    expect(note.topics).toEqual(['making', 'personal web']);
    expect(note.publication).toBe('public');
    expect(note.syndication).toEqual([
      { url: 'https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a' },
    ]);
    expect(note.legacyRssGuid).toBe('https://karthikg.in/notes/first-note-probably/');
    expect(note.createdAt.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });

  it('maps inReplyTo and bookmarkOf into relationships', () => {
    const note = mapNote({
      ...base,
      inReplyTo: 'https://example.com/post',
      bookmarkOf: 'https://example.com/saved',
    });
    expect(note.relationships).toEqual([
      { type: 'reply-to', target: { kind: 'external', url: 'https://example.com/post' } },
      { type: 'bookmark-of', target: { kind: 'external', url: 'https://example.com/saved' } },
    ]);
  });

  it('maps missing relationship fields to empty array', () => {
    expect(mapNote(base).relationships).toEqual([]);
  });

  it('fails when id is missing rather than generating one', () => {
    expect(() => mapNote({ ...base, id: '' })).toThrow(/required|Invalid ObjectId/);
  });

  it('derives awaiting-privacy-review', () => {
    const note = mapNote({ ...base, draft: false, privacyReviewed: false });
    expect(note.publication).toBe('awaiting-privacy-review');
  });
});

describe('mapProject', () => {
  it('preserves id/slug and maps tags and links', () => {
    const project = mapProject({
      id: '01a03192-07d8-729c-8080-fcafaf73f46d',
      slug: 'neighborbook',
      previousSlugs: [],
      title: 'Neighborbook',
      description: 'Private community memory',
      tags: ['Communities', 'Privacy'],
      link: 'https://neighborbook.theafoundry.com',
      featured: true,
      date: new Date('2026-07-30T00:00:00.000Z'),
    });

    expect(project.id).toBe('01a03192-07d8-729c-8080-fcafaf73f46d');
    expect(project.slug).toBe('neighborbook');
    expect(project.topics).toEqual(['Communities', 'Privacy']);
    expect(project.links).toEqual([
      { kind: 'live', url: 'https://neighborbook.theafoundry.com' },
    ]);
    expect(project.featured).toBe(true);
  });
});

describe('mapPerson', () => {
  it('preserves id and ATProto identifiers inside externalIdentities', () => {
    const person = mapPerson({
      id: '01a03192-07db-70a9-a4da-03a139669a11',
      siteUrl: 'https://karthikg.in',
      name: 'Karthik Gurumoorthy',
      tagline: 'tagline',
      avatarPath: '/avatar.svg',
      organization: { name: 'Thea Foundry', url: 'https://theafoundry.com' },
      contactMethods: [{ kind: 'email', value: 'karthi@hey.com', rel: ['me'] }],
      externalIdentities: [
        {
          kind: 'atproto',
          label: 'Bluesky',
          url: 'https://bsky.app/profile/karthikg.in',
          rel: ['me', 'atproto'],
          identifiers: {
            handle: 'karthikg.in',
            did: 'did:plc:k25m3ebqwdr32ojecqpjfzbh',
          },
        },
      ],
      interests: ['personal web'],
    });

    expect(person.id).toBe('01a03192-07db-70a9-a4da-03a139669a11');
    expect(person.externalIdentities[0]?.kind).toBe('atproto');
    expect(person.externalIdentities[0]?.identifiers).toEqual({
      handle: 'karthikg.in',
      did: 'did:plc:k25m3ebqwdr32ojecqpjfzbh',
    });
    expect('atproto' in person).toBe(false);
  });
});
