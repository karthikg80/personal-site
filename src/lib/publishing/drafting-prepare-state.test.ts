import { describe, expect, it } from 'vitest';

import {
  applyPrepareSuccess,
  buildPrepareRequest,
  buildPublishRequest,
  captureEditorialSnapshot,
  derivePrepareUi,
  isCanonicalPrepared,
  isWorkingCopyDirty,
} from './drafting-prepare-state.js';

const snapshot = captureEditorialSnapshot({
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: [],
  presentation: 'note',
  summary: '',
  body: 'A first public sentence.',
  sparks: '',
});

const prepared = applyPrepareSuccess(
  { canonicalId: '018f3b2a-7c4e-7b3a-b123-456789abcdef' },
  {
    objectId: '018f3b2a-7c4e-7b3a-b123-456789abcdef',
    slug: 'building-for-the-web-of-2030',
    blobSha: '0123456789abcdef0123456789abcdef01234567',
    commitSha: 'c123',
  },
  snapshot,
  '2026-08-24T15:00:00.000Z'
);

describe('canonical prepared vs identity', () => {
  it('does not treat canonicalId alone as Prepared', () => {
    const ui = derivePrepareUi({
      linkage: { canonicalId: prepared.canonicalId },
      snapshot,
      privacyAcknowledged: false,
    });
    expect(isCanonicalPrepared({ canonicalId: prepared.canonicalId })).toBe(false);
    expect(ui.kind).toBe('working');
    expect(ui.reviewHref).toBeUndefined();
  });

  it('treats preparedAt and blobSha together as a canonical Git object', () => {
    expect(isCanonicalPrepared({ blobSha: prepared.blobSha })).toBe(false);
    expect(isCanonicalPrepared({ preparedAt: prepared.preparedAt })).toBe(false);
    expect(isCanonicalPrepared(prepared)).toBe(true);
    expect(derivePrepareUi({ linkage: prepared, snapshot, privacyAcknowledged: true }).kind).toBe(
      'prepared'
    );
  });
});

describe('after Prepare, working-copy edits', () => {
  it('show Git still reviewed, clear only local acknowledgement, and keep blobSha', () => {
    const edited = captureEditorialSnapshot({
      title: snapshot.title,
      date: snapshot.date,
      tags: snapshot.tags,
      presentation: snapshot.presentation,
      summary: snapshot.summary,
      body: 'A changed sentence.',
      sparks: '',
    });

    expect(isWorkingCopyDirty(edited, prepared.lastPreparedSnapshot)).toBe(true);
    expect(prepared.blobSha).toBe('0123456789abcdef0123456789abcdef01234567');

    const ui = derivePrepareUi({
      linkage: prepared,
      snapshot: edited,
      privacyAcknowledged: false,
    });

    expect(ui.kind).toBe('prepared-dirty');
    expect(ui.gitStatus).toMatch(/Privacy reviewed/i);
    expect(ui.workingStatus).toMatch(/Changed since Prepare — not reviewed/);
    expect(ui.canPrepare).toBe(false);
    expect(ui.prepareLabel).toBe('Update the Git draft');
    expect(ui.reviewHref).toBe('/drafting/review/building-for-the-web-of-2030');
    expect(prepared.blobSha).toBe('0123456789abcdef0123456789abcdef01234567');
  });

  it('enables Update only after acknowledgement is checked again', () => {
    const edited = { ...snapshot, body: 'A changed sentence.' };
    const withoutAck = derivePrepareUi({
      linkage: prepared,
      snapshot: edited,
      privacyAcknowledged: false,
    });
    const withAck = derivePrepareUi({
      linkage: prepared,
      snapshot: edited,
      privacyAcknowledged: true,
    });
    expect(withoutAck.canPrepare).toBe(false);
    expect(withAck.canPrepare).toBe(true);
  });

  it('replaces blobSha only on a later successful Prepare', () => {
    const updated = applyPrepareSuccess(
      prepared,
      {
        objectId: prepared.canonicalId!,
        slug: prepared.slug!,
        blobSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      { ...snapshot, body: 'A changed sentence.' },
      '2026-08-24T16:00:00.000Z'
    );
    expect(prepared.blobSha).toBe('0123456789abcdef0123456789abcdef01234567');
    expect(updated.blobSha).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(updated.lastPreparedSnapshot?.body).toBe('A changed sentence.');
  });
});

describe('buildPublishRequest', () => {
  it('sends only objectId, slug, and expectedBlobSha', () => {
    const request = buildPublishRequest({
      objectId: '018f3b2a-7c4e-7b3a-b123-456789abcdef',
      slug: 'building-for-the-web-of-2030',
      expectedBlobSha: '0123456789abcdef0123456789abcdef01234567',
    });
    expect(Object.keys(request).sort()).toEqual(['expectedBlobSha', 'objectId', 'slug']);
  });
});

describe('buildPrepareRequest', () => {
  const base = {
    canonicalId: '018f3b2a-7c4e-7b3a-b123-456789abcdef',
    slug: 'building-for-the-web-of-2030',
    title: 'Building for the web of 2030',
    date: '2026-08-24',
    tags: [] as string[],
    presentation: 'note' as const,
    body: 'Hello',
    sparks: '',
  };

  it('never sends draft or privacyReviewed', () => {
    const request = buildPrepareRequest(base);
    expect(request).not.toHaveProperty('draft');
    expect(request).not.toHaveProperty('privacyReviewed');
    expect(request.privacyAcknowledgement).toBe(true);
    expect(request.relationships).toEqual([]);
    expect(request.distribution).toEqual({ webmentions: false, bluesky: false });
  });

  it('sends an external reply-to when a URL is supplied', () => {
    const request = buildPrepareRequest({
      ...base,
      replyToUrl: 'https://karthikg.in/notes/changing-the-drafting-room/',
    });
    expect(request.relationships).toEqual([
      {
        type: 'reply-to',
        target: { kind: 'external', url: 'https://karthikg.in/notes/changing-the-drafting-room/' },
      },
    ]);
  });
});

describe('published and unprepared', () => {
  it('disables Prepare after publish', () => {
    const ui = derivePrepareUi({
      linkage: { ...prepared, publishedAt: '2026-08-24T16:00:00.000Z' },
      snapshot,
      privacyAcknowledged: true,
    });
    expect(ui.kind).toBe('published');
    expect(ui.canPrepare).toBe(false);
    expect(ui.prepareLabel).toBe('Already published');
  });

  it('does not become Prepared when acknowledgement is missing', () => {
    const ui = derivePrepareUi({
      linkage: {},
      snapshot,
      privacyAcknowledged: false,
    });
    expect(ui.canPrepare).toBe(false);
    expect(ui.kind).toBe('working');
  });
});
