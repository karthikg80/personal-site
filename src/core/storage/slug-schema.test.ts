import { describe, expect, it } from 'vitest';

import { contentSlugSchema, previousSlugsSchema, withSlugHistory } from './slug-schema.js';
import { z } from 'zod';

describe('contentSlugSchema', () => {
  it('accepts current production slugs', () => {
    for (const slug of [
      'first-note-probably',
      'README',
      'neighborbook',
      'thea-kitchen',
      'sai-parayan-tracker',
      'pantry-mojo',
      'homebase',
    ]) {
      expect(contentSlugSchema.parse(slug)).toBe(slug);
    }
  });

  it('rejects path separators and whitespace', () => {
    expect(contentSlugSchema.safeParse('../escape').success).toBe(false);
    expect(contentSlugSchema.safeParse('a/b').success).toBe(false);
    expect(contentSlugSchema.safeParse('has space').success).toBe(false);
    expect(contentSlugSchema.safeParse('').success).toBe(false);
  });
});

describe('previousSlugsSchema', () => {
  it('rejects duplicate entries', () => {
    expect(previousSlugsSchema.safeParse(['old', 'old']).success).toBe(false);
  });
});

describe('withSlugHistory', () => {
  const schema = withSlugHistory({
    slug: contentSlugSchema,
    previousSlugs: previousSlugsSchema,
  });

  it('rejects self-history', () => {
    expect(schema.safeParse({ slug: 'foo', previousSlugs: ['foo'] }).success).toBe(false);
  });

  it('accepts distinct history', () => {
    expect(schema.parse({ slug: 'new', previousSlugs: ['old'] })).toEqual({
      slug: 'new',
      previousSlugs: ['old'],
    });
  });
});
