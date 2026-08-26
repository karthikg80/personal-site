import { describe, expect, it } from 'vitest';

import { partitionLocalDrafts } from './drafting-list.js';

describe('partitionLocalDrafts', () => {
  it('keeps published browser copies out of the working list', () => {
    const workingOlder = { id: 'working-older', updatedAt: '2026-08-20T10:00:00.000Z' };
    const published = {
      id: 'published',
      publishedAt: '2026-08-24T10:00:00.000Z',
      updatedAt: '2026-08-24T10:00:00.000Z',
    };
    const workingNewer = { id: 'working-newer', updatedAt: '2026-08-25T10:00:00.000Z' };

    const result = partitionLocalDrafts([workingOlder, published, workingNewer]);

    expect(result.workingDrafts.map((draft) => draft.id)).toEqual(['working-newer', 'working-older']);
    expect(result.publishedDrafts.map((draft) => draft.id)).toEqual(['published']);
  });
});
