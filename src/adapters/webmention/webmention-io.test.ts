import { describe, expect, it } from 'vitest';

import {
  webmentionFeedUrl,
  webmentionPingbackUrl,
  webmentionReceiverUrl,
} from './webmention-io.js';

describe('webmention.io provider URLs', () => {
  it('keeps the site-wide receiver URL', () => {
    expect(webmentionReceiverUrl()).toBe('https://webmention.io/karthikg.in/webmention');
  });

  it('keeps the site-wide pingback URL', () => {
    expect(webmentionPingbackUrl()).toBe('https://webmention.io/karthikg.in/xmlrpc');
  });

  it('keeps the JF2 feed URL encoding', () => {
    expect(webmentionFeedUrl('https://karthikg.in/notes/first-note-probably/')).toBe(
      'https://webmention.io/api/mentions.jf2?per-page=50&target=https%3A%2F%2Fkarthikg.in%2Fnotes%2Ffirst-note-probably%2F'
    );
  });
});
