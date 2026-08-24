import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { noteRelationshipSchema } from './core/storage/note-relationship-schema.js';
import {
  contentSlugSchema,
  previousSlugsSchema,
  withSlugHistory,
} from './core/storage/slug-schema.js';

const objectIdSchema = z.string().uuid();

const projectsCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/projects' }),
  schema: withSlugHistory({
    id: objectIdSchema,
    slug: contentSlugSchema,
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
  schema: withSlugHistory({
    id: objectIdSchema,
    slug: contentSlugSchema,
    previousSlugs: previousSlugsSchema,
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    presentation: z.enum(['note', 'scrap']).default('note'),
    relationships: noteRelationshipSchema,
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
