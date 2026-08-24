import { type CollectionEntry } from 'astro:content';

import { getPublishedNoteRecords } from '../core/storage/content.js';

export type Note = CollectionEntry<'notes'>;

/**
 * Returns Astro collection entries for published notes.
 * Publication filtering uses the canonical domain rule via storage mapping.
 * Entries are retained so pages can call render(entry).
 */
export async function getPublishedNotes(): Promise<Note[]> {
  const records = await getPublishedNoteRecords();
  return records.map((record) => record.entry);
}

/**
 * Current canonical note path from frontmatter slug.
 * Kept outside domain; historical paths belong to the routing/Webmention adapters.
 */
export function notePath(note: Note): string {
  return `/notes/${note.data.slug}/`;
}

export function formatNoteDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
