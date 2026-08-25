import { describe, expect, it } from 'vitest';

import { parsePrepareRequest } from './prepare-request.js';

const valid = {
  canonicalId: '018f3b2a-7c4e-7b3a-b123-456789abcdef',
  slug: 'building-for-the-web-of-2030',
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: [] as string[],
  presentation: 'note',
  body: 'A first public sentence.',
  privacyAcknowledgement: true,
};

describe('parsePrepareRequest', () => {
  it('refuses without privacyAcknowledgement', () => {
    expect(() => parsePrepareRequest({ ...valid, privacyAcknowledgement: false })).toThrow(
      /Privacy acknowledgement/
    );
    expect(() => parsePrepareRequest({ ...valid, privacyAcknowledgement: 'true' })).toThrow(
      /Privacy acknowledgement/
    );
    const { privacyAcknowledgement: _omitted, ...withoutAck } = valid;
    expect(() => parsePrepareRequest(withoutAck)).toThrow(/Privacy acknowledgement/);
  });

  it('rejects draft or privacyReviewed if the client sends them', () => {
    expect(() => parsePrepareRequest({ ...valid, draft: false })).toThrow(/not accepted/);
    expect(() => parsePrepareRequest({ ...valid, privacyReviewed: true })).toThrow(/not accepted/);
  });

  it('rejects unknown keys', () => {
    expect(() => parsePrepareRequest({ ...valid, expectedBlobSha: 'abc' })).toThrow(/unknown/i);
  });

  it('serialized markdown is always unpublished and privacy-reviewed', () => {
    const parsed = parsePrepareRequest(valid);
    expect(parsed.privacyAcknowledgement).toBe(true);
    expect(parsed.canonicalId).toBe(valid.canonicalId);
    expect(parsed.slug).toBe(valid.slug);
    expect(parsed.markdown).toMatch(/^---[\s\S]*draft: true/m);
    expect(parsed.markdown).toMatch(/^privacyReviewed: true/m);
    expect(parsed.markdown).not.toMatch(/legacyRssGuid/);
    expect(parsed.markdown).toMatch(/webmentions: false/);
    expect(parsed.markdown).toMatch(/bluesky: false/);
  });

  it('rejects README slug', () => {
    expect(() => parsePrepareRequest({ ...valid, slug: 'README' })).toThrow(/reserved/i);
  });

  it('records opt-in distribution intent without touching publication gates', () => {
    const parsed = parsePrepareRequest({
      ...valid,
      distribution: { webmentions: true, bluesky: true },
    });
    expect(parsed.markdown).toMatch(/^draft: true$/m);
    expect(parsed.markdown).toContain('webmentions: true');
    expect(parsed.markdown).toContain('bluesky: true');
  });

  it('keeps an external reply-to in the unpublished Git draft', () => {
    const parsed = parsePrepareRequest({
      ...valid,
      relationships: [
        {
          type: 'reply-to',
          target: { kind: 'external', url: 'https://karthikg.in/notes/changing-the-drafting-room/' },
        },
      ],
    });
    expect(parsed.markdown).toMatch(/^draft: true$/m);
    expect(parsed.markdown).toContain('reply-to');
    expect(parsed.markdown).toContain('https://karthikg.in/notes/changing-the-drafting-room/');
  });

  it('requires a title', () => {
    expect(() => parsePrepareRequest({ ...valid, title: '   ' })).toThrow(/Title is required/);
  });

  it('requires a UTC calendar date', () => {
    expect(() => parsePrepareRequest({ ...valid, date: '08/24/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => parsePrepareRequest({ ...valid, date: '2026-02-30' })).toThrow(/YYYY-MM-DD/);
  });

  it('falls back to sparks when body is empty', () => {
    const parsed = parsePrepareRequest({ ...valid, body: '  ', sparks: 'A spark that becomes the body.' });
    expect(parsed.markdown).toContain('A spark that becomes the body.');
  });

  it('refuses when body and sparks are empty', () => {
    expect(() => parsePrepareRequest({ ...valid, body: '', sparks: '' })).toThrow(/Add a draft body/);
  });
});
