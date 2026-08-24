import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const objectIdSchema = z.string().uuid();
const slugSchema = z.string().min(1);
const previousSlugsSchema = z.array(z.string().min(1)).default([]);

const projectsCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    id: objectIdSchema,
    slug: slugSchema,
    previousSlugs: previousSlugsSchema,
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()),
    links: z
      .array(
        z.object({
          kind: z.enum(['live', 'github', 'other']),
          url: z.url(),
          label: z.string().optional(),
        })
      )
      .default([]),
    featured: z.boolean().default(false),
  }),
});

const notesCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    id: objectIdSchema,
    slug: slugSchema,
    previousSlugs: previousSlugsSchema,
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    presentation: z.enum(['note', 'scrap']).default('note'),
    relationships: z
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
              id: objectIdSchema,
              expectedKind: z.enum(['note', 'project']).optional(),
            }),
          ]),
        })
      )
      .default([]),
    syndication: z.array(z.url()).default([]),
    legacyRssGuid: z.string().url().optional(),
    draft: z.boolean().default(true),
    privacyReviewed: z.boolean().default(false),
  }),
});

export const collections = {
  projects: projectsCollection,
  notes: notesCollection,
};
