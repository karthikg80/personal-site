import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'notes'>;

export async function getPublishedNotes(): Promise<Note[]> {
  const notes = await getCollection(
    'notes',
    ({ data }) => !data.draft && data.privacyReviewed
  );

  return notes.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

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
