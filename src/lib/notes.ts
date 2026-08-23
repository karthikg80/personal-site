import { getCollection, type CollectionEntry } from 'astro:content';
import { classifyNote, isPublishedNote, type NoteKind } from './indieweb';

export type Note = CollectionEntry<'notes'>;
export type { NoteKind };

export { classifyNote };

export async function getPublishedNotes(): Promise<Note[]> {
  const notes = await getCollection(
    'notes',
    ({ data }) => isPublishedNote(data)
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
