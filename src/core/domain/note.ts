import type { ObjectId } from './ids.js';
import type { PublicationState } from './publication.js';
import { isPublicPublication } from './publication.js';
import type { Relationship } from './relationship.js';
import type { SyndicationCopy } from './syndication.js';

export type NoteKind = 'note' | 'scrap' | 'reply' | 'bookmark';

export interface Note {
  id: ObjectId;
  slug: string;
  previousSlugs: string[];
  title: string;
  summary?: string;
  presentation: 'note' | 'scrap';
  topics: string[];
  publication: PublicationState;
  relationships: Relationship[];
  syndication: SyndicationCopy[];
  createdAt: Date;
  updatedAt?: Date;
  legacyRssGuid?: string;
}

/**
 * Precedence matches historical classifyNote:
 * reply > bookmark > scrap > note
 */
export function deriveNoteKind(note: {
  presentation: 'note' | 'scrap';
  relationships: Relationship[];
}): NoteKind {
  if (note.relationships.some((relationship) => relationship.type === 'reply-to')) {
    return 'reply';
  }
  if (note.relationships.some((relationship) => relationship.type === 'bookmark-of')) {
    return 'bookmark';
  }
  if (note.presentation === 'scrap') {
    return 'scrap';
  }
  return 'note';
}

export function isPublicNote(note: Pick<Note, 'publication'>): boolean {
  return isPublicPublication(note.publication);
}
