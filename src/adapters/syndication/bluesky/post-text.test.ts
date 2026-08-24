import { describe, expect, it } from 'vitest';

import { buildBlueskyPostText } from './post-text.js';

const permalink = 'https://karthikg.in/notes/first-note-probably/';

describe('buildBlueskyPostText', () => {
  it('keeps the permalink and stays within the Bluesky limit', () => {
    const post = buildBlueskyPostText({
      title: 'First note, probably',
      url: permalink,
      summary: 'I have never published a personal blog before.',
    });

    expect(post.text).toContain(permalink);
    expect(post.text.length).toBeLessThanOrEqual(300);
    expect(post.text.startsWith('First note, probably')).toBe(true);
    expect(post.text).toBe(
      `First note, probably\nI have never published a personal blog before.\n\n${permalink}`
    );
  });

  it('omits a summary that would exceed the remaining budget', () => {
    const post = buildBlueskyPostText({
      title: 'First note, probably',
      url: permalink,
      summary: 'x'.repeat(280),
    });

    expect(post.text).toBe(`First note, probably\n\n${permalink}`);
    expect(post.text.length).toBeLessThanOrEqual(300);
  });

  it('truncates a long title and still includes the canonical permalink', () => {
    const post = buildBlueskyPostText({
      title: 'T'.repeat(400),
      url: permalink,
    });

    expect(post.text.endsWith(`\n\n${permalink}`)).toBe(true);
    expect(post.text).toContain('…');
    expect(post.text.length).toBeLessThanOrEqual(300);
  });
});
