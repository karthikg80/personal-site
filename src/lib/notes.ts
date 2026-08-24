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
 * Presentation helper — Astro entry id is the filename stem (matches slug after M1).
 * Kept outside domain; routing adapters will own path policy later (M8).
 */
export function notePath(note: Note): string {
  return `/notes/${note.id}/`;
}

export function formatNoteDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
