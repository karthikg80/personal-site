import type { Note } from '../../core/domain/note.js';
import { findRelationship } from '../../core/domain/relationship.js';

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
