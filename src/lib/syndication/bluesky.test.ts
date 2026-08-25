import { describe, expect, it } from 'vitest';

import { buildBlueskyPostRecord, putBlueskyPost } from './bluesky.js';
import { tidFromObjectId } from './tid.js';

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';

describe('putBlueskyPost', () => {
  it('uses putRecord with a TID rkey derived from the ObjectId', async () => {
    const built = buildBlueskyPostRecord({
      objectId,
      slug: 'building-for-the-web-of-2030',
      title: 'Building for the web of 2030',
    });
    expect(built.rkey).toBe(tidFromObjectId(objectId));
    expect(built.rkey).toHaveLength(13);

    let recordedBody: { rkey?: string } | undefined;
    const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain('com.atproto.repo.putRecord');
      expect(url).not.toContain('createRecord');
      recordedBody = JSON.parse(String(init?.body)) as { rkey?: string };
      return new Response(JSON.stringify({ uri: `at://did:plc:test/app.bsky.feed.post/${built.rkey}` }), {
        status: 200,
      });
    };

    const url = await putBlueskyPost({
      session: { did: 'did:plc:test', accessJwt: 'jwt', handle: 'karthikg.in' },
      objectId,
      slug: 'building-for-the-web-of-2030',
      title: 'Building for the web of 2030',
      fetchImpl: fetchMock,
    });

    expect(url).toBe(`https://bsky.app/profile/karthikg.in/post/${built.rkey}`);
    expect(recordedBody?.rkey).toBe(built.rkey);
  });
});
