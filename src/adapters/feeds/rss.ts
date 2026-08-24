import type { Note } from '../../core/domain/note.js';

export type RssGuid = {
  value: string;
  isPermaLink: boolean;
};

/**
 * RSS item identity projection.
 * - Legacy public notes keep their historical URL GUID forever.
 * - New notes derive immutable URN GUIDs from ObjectId.
 */
export function rssGuidForNote(note: Pick<Note, 'id' | 'legacyRssGuid'>): RssGuid {
  if (note.legacyRssGuid) {
    return {
      value: note.legacyRssGuid,
      isPermaLink: true,
    };
  }

  return {
    value: `urn:karthikg.in:note:${note.id}`,
    isPermaLink: false,
  };
}
