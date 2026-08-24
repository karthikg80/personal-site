import { describe, expect, it } from 'vitest';

import { extractOutboundLinks, markdownToLinkHtml } from './outbound-targets.js';

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

  it('drops same-origin reply and bookmark targets', () => {
    expect(
      extractOutboundLinks('<p>no links</p>', 'https://karthikg.in', {
        inReplyTo: 'https://karthikg.in/notes/other/',
        bookmarkOf: '/notes/local/',
      })
    ).toEqual([]);
  });
});

describe('markdownToLinkHtml', () => {
  it('converts markdown links to href markup used by outbound extraction', () => {
    expect(markdownToLinkHtml('See [one](https://example.com/a) and text.')).toBe(
      'See <a href="https://example.com/a">one</a> and text.'
    );
  });
});
