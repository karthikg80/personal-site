import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoverWebmentionEndpoint, sendWebmention } from './discovery.js';

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

  it('accepts the historical webmention.org relation in a Link header', () => {
    const endpoint = discoverWebmentionEndpoint({
      target: 'https://example.com/post',
      headers: {
        Link: '<https://example.com/endpoint>; rel="http://webmention.org/"',
      },
      html: '',
    });

    expect(endpoint).toBe('https://example.com/endpoint');
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

describe('sendWebmention', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs application/x-www-form-urlencoded source and target', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await sendWebmention(
      'https://example.com/wm',
      'https://karthikg.in/notes/first-note-probably/',
      'https://example.com/post'
    );

    expect(status).toBe(202);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://example.com/wm');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'karthikg.in webmention sender',
    });
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect(String(init.body)).toBe(
      'source=https%3A%2F%2Fkarthikg.in%2Fnotes%2Ffirst-note-probably%2F&target=https%3A%2F%2Fexample.com%2Fpost'
    );
  });
});
