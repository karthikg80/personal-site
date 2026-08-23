import { defineCollection, z } from 'astro:content';

const projectsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    tags: z.array(z.string()),
    link: z.string().url().optional(),
    github: z.string().url().optional(),
    featured: z.boolean().default(false),
  }),
});

const notesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    presentation: z.enum(['note', 'scrap']).default('note'),
    draft: z.boolean().default(true),
    privacyReviewed: z.boolean().default(false),
  }),
});

export const collections = {
  projects: projectsCollection,
  notes: notesCollection,
};
