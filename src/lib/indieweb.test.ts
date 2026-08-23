import { describe, expect, it } from 'vitest';
import {
  buildBlueskyPostText,
  classifyNote,
  discoverWebmentionEndpoint,
  extractOutboundLinks,
  hostLabel,
  isPublishedNote,
  normalizeSyndicationUrl,
} from './indieweb';

describe('isPublishedNote', () => {
  it('requires both publication flags', () => {
    expect(isPublishedNote({ draft: false, privacyReviewed: true })).toBe(true);
    expect(isPublishedNote({ draft: true, privacyReviewed: true })).toBe(false);
    expect(isPublishedNote({ draft: false, privacyReviewed: false })).toBe(false);
  });
});

describe('classifyNote', () => {
  it('treats an in-reply-to URL as a reply', () => {
    expect(classifyNote({ inReplyTo: 'https://example.com/post' })).toBe('reply');
  });

  it('treats a bookmark-of URL as a bookmark', () => {
    expect(classifyNote({ bookmarkOf: 'https://example.com/page' })).toBe('bookmark');
  });

  it('keeps scrap as a visual presentation, not a reply', () => {
    expect(classifyNote({ presentation: 'scrap' })).toBe('scrap');
  });
});

describe('extractOutboundLinks', () => {
  it('returns unique absolute http(s) links that are not on this site', () => {
    const html = `
      <p>See <a href="https://example.com/a">one</a> and
      <a href="/notes/local/">local</a> and
      <a href="https://example.com/a">again</a> and
      <a href="mailto:hi@example.com">mail</a>.</p>
    `;

    expect(extractOutboundLinks(html, 'https://karthikg.in')).toEqual([
      'https://example.com/a',
    ]);
  });

  it('includes reply and bookmark targets even when they are not in the body', () => {
    expect(
      extractOutboundLinks('<p>no links</p>', 'https://karthikg.in', {
        inReplyTo: 'https://other.example/reply-target',
        bookmarkOf: 'https://other.example/saved',
      })
    ).toEqual([
      'https://other.example/reply-target',
      'https://other.example/saved',
    ]);
  });
});

describe('discoverWebmentionEndpoint', () => {
  it('prefers a Link header over document markup', () => {
    const endpoint = discoverWebmentionEndpoint({
      target: 'https://example.com/post',
      headers: {
        link: '<https://example.com/wm>; rel="webmention"',
      },
      html: '<link rel="webmention" href="/html-wm">',
    });

    expect(endpoint).toBe('https://example.com/wm');
  });

  it('finds a relative link rel=webmention in HTML', () => {
    const endpoint = discoverWebmentionEndpoint({
      target: 'https://example.com/post',
      headers: {},
      html: '<link rel="webmention" href="/webmention">',
    });

    expect(endpoint).toBe('https://example.com/webmention');
  });

  it('returns null when no endpoint exists', () => {
    expect(
      discoverWebmentionEndpoint({
        target: 'https://example.com/post',
        headers: {},
        html: '<p>nothing here</p>',
      })
    ).toBeNull();
  });
});

describe('buildBlueskyPostText', () => {
  it('keeps the permalink and stays within the Bluesky limit', () => {
    const post = buildBlueskyPostText({
      title: 'First note, probably',
      url: 'https://karthikg.in/notes/first-note-probably/',
      summary: 'I have never published a personal blog before.',
    });

    expect(post.text).toContain('https://karthikg.in/notes/first-note-probably/');
    expect(post.text.length).toBeLessThanOrEqual(300);
    expect(post.text.startsWith('First note, probably')).toBe(true);
  });
});

describe('hostLabel', () => {
  it('strips www from a hostname', () => {
    expect(hostLabel('https://www.example.com/path')).toBe('example.com');
  });
});

describe('normalizeSyndicationUrl', () => {
  it('accepts a Bluesky post URL', () => {
    expect(
      normalizeSyndicationUrl('https://bsky.app/profile/karthikg.in/post/abc')
    ).toBe('https://bsky.app/profile/karthikg.in/post/abc');
  });
});
