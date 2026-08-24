import { describe, expect, it } from 'vitest';

import { mergeWebmentionMentions, type WebmentionMention } from './merge-mentions.js';

function mention(overrides: Partial<WebmentionMention> = {}): WebmentionMention {
  return {
    url: 'https://example.com/a',
    'wm-property': 'like-of',
    author: { name: 'A', url: 'https://example.com/' },
    ...overrides,
  };
}

describe('mergeWebmentionMentions', () => {
  it('merges mentions from current and historical targets', () => {
    const merged = mergeWebmentionMentions([
      [mention({ 'wm-id': 1, 'wm-property': 'like-of' })],
      [mention({ 'wm-id': 2, url: 'https://example.com/b', 'wm-property': 'in-reply-to' })],
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((entry) => entry['wm-id'])).toEqual([1, 2]);
  });

  it('dedupes the same mention returned from multiple target queries', () => {
    const shared = mention({ 'wm-id': 42, 'wm-property': 'repost-of' });
    expect(mergeWebmentionMentions([[shared], [shared], []])).toEqual([shared]);
  });

  it('keeps successful batches when another target is empty', () => {
    const like = mention({ 'wm-id': 7, 'wm-property': 'like-of' });
    expect(mergeWebmentionMentions([[], [like], []])).toEqual([like]);
  });

  it('preserves like/repost/reply property values for existing grouping', () => {
    const merged = mergeWebmentionMentions([
      [
        mention({ 'wm-id': 1, 'wm-property': 'like-of' }),
        mention({ 'wm-id': 2, 'wm-property': 'repost-of' }),
        mention({ 'wm-id': 3, 'wm-property': 'in-reply-to' }),
        mention({ 'wm-id': 4, 'wm-property': 'mention-of' }),
      ],
    ]);
    expect(merged.map((entry) => entry['wm-property'])).toEqual([
      'like-of',
      'repost-of',
      'in-reply-to',
      'mention-of',
    ]);
  });
});
