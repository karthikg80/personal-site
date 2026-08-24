import { z } from 'zod';

/**
 * URL path segment for current and historical slugs.
 * Allows existing production values (including README) while blocking
 * separators that would escape a single route segment.
 */
export const contentSlugSchema = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$|^[A-Za-z0-9]$/,
    'Slug must be a single URL path segment (letters, digits, ., _, -)'
  );

export const previousSlugsSchema = z
  .array(contentSlugSchema)
  .default([])
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (seen.has(entry)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate previousSlugs entry ${entry}`,
          path: [index],
        });
      }
      seen.add(entry);
    }
  });

export function withSlugHistory<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((value, ctx) => {
    const slug = value.slug;
    const previousSlugs = value.previousSlugs;
    if (typeof slug !== 'string' || !Array.isArray(previousSlugs)) return;
    if (previousSlugs.includes(slug)) {
      ctx.addIssue({
        code: 'custom',
        message: `previousSlugs must not include current slug ${slug}`,
        path: ['previousSlugs'],
      });
    }
  });
}
