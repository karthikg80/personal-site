import { describe, expect, it } from 'vitest';

import { noteMentionTargets } from './mention-targets.js';

describe('noteMentionTargets', () => {
  it('returns only the current URL when previousSlugs is empty', () => {
    expect(
      noteMentionTargets({ slug: 'current', previousSlugs: [] })
    ).toEqual(['https://karthikg.in/notes/current/']);
  });

  it('lists current URL first, then historical URLs in order', () => {
    expect(
      noteMentionTargets({
        slug: 'current',
        previousSlugs: ['old1', 'old2'],
      })
    ).toEqual([
      'https://karthikg.in/notes/current/',
      'https://karthikg.in/notes/old1/',
      'https://karthikg.in/notes/old2/',
    ]);
  });

  it('dedupes malformed repeated slugs without weakening schema expectations', () => {
    expect(
      noteMentionTargets({
        slug: 'current',
        previousSlugs: ['old', 'current', 'old'],
      })
    ).toEqual([
      'https://karthikg.in/notes/current/',
      'https://karthikg.in/notes/old/',
    ]);
  });
});
