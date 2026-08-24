import { z } from 'zod';

/**
 * Canonical Note.relationships frontmatter schema.
 * Shared by content collections and storage validation tests.
 */
export const noteRelationshipSchema = z
  .array(
    z.object({
      type: z.enum(['reply-to', 'bookmark-of']),
      target: z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('external'),
          url: z.url(),
        }),
        z.object({
          kind: z.literal('internal'),
          id: z.string().uuid(),
          expectedKind: z.enum(['note', 'project']).optional(),
        }),
      ]),
    })
  )
  .default([]);
