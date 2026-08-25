import { describe, expect, it } from 'vitest';

import { parsePublishRequest } from './publish-request.js';

const valid = {
  objectId: '018f3b2a-7c4e-7b3a-b123-456789abcdef',
  slug: 'building-for-the-web-of-2030',
  expectedBlobSha: '0123456789abcdef0123456789abcdef01234567',
};

describe('parsePublishRequest', () => {
  it('accepts objectId, slug, and expectedBlobSha only', () => {
    expect(parsePublishRequest(valid)).toEqual(valid);
  });

  it('rejects privacyAcknowledgement', () => {
    expect(() => parsePublishRequest({ ...valid, privacyAcknowledgement: true })).toThrow(
      /privacyAcknowledgement|not accepted/i
    );
  });

  it('rejects unknown keys', () => {
    expect(() => parsePublishRequest({ ...valid, draft: false })).toThrow(/unknown|not accepted/i);
    expect(() => parsePublishRequest({ ...valid, body: 'nope' })).toThrow(/unknown/i);
  });

  it('rejects README and invalid ObjectIds', () => {
    expect(() => parsePublishRequest({ ...valid, slug: 'README' })).toThrow(/reserved/i);
    expect(() =>
      parsePublishRequest({ ...valid, objectId: '550e8400-e29b-41d4-a716-446655440000' })
    ).toThrow(/UUIDv7/);
  });

  it('requires a Git blob SHA', () => {
    expect(() => parsePublishRequest({ ...valid, expectedBlobSha: '' })).toThrow(/sha/i);
    expect(() => parsePublishRequest({ ...valid, expectedBlobSha: 'not a sha' })).toThrow(/sha/i);
  });
});
