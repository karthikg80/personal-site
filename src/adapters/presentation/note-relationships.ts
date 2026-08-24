import type { Note } from '../../core/domain/note.js';
import {
  findRelationship,
  type RelationshipType,
} from '../../core/domain/relationship.js';

/** Microformat class for a canonical relationship type (presentation only). */
export function relationshipMicroformatClass(
  type: RelationshipType
): 'u-in-reply-to' | 'u-bookmark-of' {
  return type === 'reply-to' ? 'u-in-reply-to' : 'u-bookmark-of';
}

/** External reply-to URL for u-in-reply-to projection. */
export function externalReplyUrl(note: Pick<Note, 'relationships'>): string | undefined {
  const relationship = findRelationship(note.relationships, 'reply-to');
  return relationship?.target.kind === 'external' ? relationship.target.url : undefined;
}

/** External bookmark-of URL for u-bookmark-of projection. */
export function externalBookmarkUrl(note: Pick<Note, 'relationships'>): string | undefined {
  const relationship = findRelationship(note.relationships, 'bookmark-of');
  return relationship?.target.kind === 'external' ? relationship.target.url : undefined;
}
