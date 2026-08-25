import { describe, expect, it } from 'vitest';

import { serializePreparedNote } from './note-markdown.js';
import {
  appendSyndicationUrl,
  detectPublishTransition,
  liveNoteHasObjectId,
  parseDistributionIntent,
  readPromotedCommitSha,
  shouldCreateBlueskyCopy,
  shouldDistribute,
} from './distribution.js';

const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const path = 'src/content/notes/building-for-the-web-of-2030.md';

function prepared(distribution = { webmentions: true, bluesky: true }): string {
  return serializePreparedNote({
    id,
    slug: 'building-for-the-web-of-2030',
    title: 'Building for the web of 2030',
    date: '2026-08-24',
    tags: [],
    presentation: 'note',
    relationships: [],
    distribution,
    body: 'Hello.\n',
  });
}

describe('parseDistributionIntent', () => {
  it('defaults both flags off when omitted', () => {
    expect(parseDistributionIntent(undefined)).toEqual({ webmentions: false, bluesky: false });
  });

  it('requires both booleans when present', () => {
    expect(() => parseDistributionIntent({ webmentions: true })).toThrow(/boolean/);
  });
});

describe('readPromotedCommitSha', () => {
  it('reads git.sha from a Vercel repository_dispatch payload', () => {
    expect(readPromotedCommitSha({
      environment: 'production',
      git: { ref: 'main', sha: 'abcdef1234567890abcdef1234567890abcdef12' },
    })).toBe('abcdef1234567890abcdef1234567890abcdef12');
  });
});

describe('detectPublishTransition', () => {
  it('requires draft true → false on the same ObjectId', () => {
    const before = prepared();
    const after = before.replace(/^draft: true$/m, 'draft: false');
    const transition = detectPublishTransition(path, before, after);
    expect(transition).toMatchObject({
      objectId: id,
      slug: 'building-for-the-web-of-2030',
      intent: { webmentions: true, bluesky: true },
      syndication: [],
    });
    expect(shouldDistribute(transition!)).toBe(true);
    expect(shouldCreateBlueskyCopy(transition!)).toBe(true);
  });

  it('ignores Prepare, syndication-only, and already-public files', () => {
    const unpublished = prepared();
    expect(detectPublishTransition(path, null, unpublished)).toBeNull();
    expect(detectPublishTransition(path, unpublished, unpublished)).toBeNull();
    const published = unpublished.replace(/^draft: true$/m, 'draft: false');
    const withSyndication = appendSyndicationUrl(published, 'https://bsky.app/profile/karthikg.in/post/3abc').text;
    expect(detectPublishTransition(path, published, withSyndication)).toBeNull();
  });

  it('does not create a Bluesky copy when syndication is already present', () => {
    const before = prepared();
    const published = appendSyndicationUrl(
      before.replace(/^draft: true$/m, 'draft: false'),
      'https://bsky.app/profile/karthikg.in/post/3abc'
    ).text;
    const transition = detectPublishTransition(path, before, published);
    expect(shouldCreateBlueskyCopy(transition!)).toBe(false);
    expect(shouldDistribute(transition!)).toBe(true);
  });
});

describe('appendSyndicationUrl', () => {
  it('appends once and leaves a second call unchanged', () => {
    const url = 'https://bsky.app/profile/karthikg.in/post/3abc';
    const first = appendSyndicationUrl(prepared(), url);
    expect(first.changed).toBe(true);
    expect(first.text).toContain(url);
    const second = appendSyndicationUrl(first.text, url);
    expect(second.changed).toBe(false);
    expect(second.text).toBe(first.text);
  });
});

describe('liveNoteHasObjectId', () => {
  it('matches the public note data attribute', () => {
    expect(liveNoteHasObjectId(`<article data-object-id="${id}">`, id)).toBe(true);
    expect(liveNoteHasObjectId('<article data-object-id="nope">', id)).toBe(false);
  });
});
