import { parseObjectId, type ObjectId } from '../domain/ids.js';
import type { Note } from '../domain/note.js';
import { derivePublicationState } from '../domain/publication.js';
import type { Relationship } from '../domain/relationship.js';
import type { SyndicationCopy } from '../domain/syndication.js';
import { asOptionalUrlString, asUrlString } from './url-value.js';

export type NoteStorageData = {
  id: string;
  slug: string;
  previousSlugs: string[];
  title: string;
  summary?: string;
  presentation: 'note' | 'scrap';
  tags: string[];
  draft: boolean;
  privacyReviewed: boolean;
  inReplyTo?: string | URL;
  bookmarkOf?: string | URL;
  syndication: Array<string | URL>;
  legacyRssGuid?: string | URL;
  date: Date;
  updated?: Date;
};

function relationshipsFromStorage(data: NoteStorageData): Relationship[] {
  const relationships: Relationship[] = [];
  const inReplyTo = asOptionalUrlString(data.inReplyTo);
  const bookmarkOf = asOptionalUrlString(data.bookmarkOf);

  if (inReplyTo) {
    relationships.push({
      type: 'reply-to',
      target: { kind: 'external', url: inReplyTo },
    });
  }
  if (bookmarkOf) {
    relationships.push({
      type: 'bookmark-of',
      target: { kind: 'external', url: bookmarkOf },
    });
  }
  return relationships;
}

/**
 * Map Astro note collection data → domain Note.
 * Does not generate IDs, slugs, or RSS GUIDs. Missing id throws.
 * Markdown body stays on the Astro collection entry for render().
 */
export function mapNote(data: NoteStorageData): Note {
  const id: ObjectId = parseObjectId(data.id);
  const syndication: SyndicationCopy[] = data.syndication.map((url) => ({
    url: asUrlString(url),
  }));

  return {
    id,
    slug: data.slug,
    previousSlugs: [...data.previousSlugs],
    title: data.title,
    summary: data.summary,
    presentation: data.presentation,
    topics: [...data.tags],
    publication: derivePublicationState(data.draft, data.privacyReviewed),
    relationships: relationshipsFromStorage(data),
    syndication,
    createdAt: data.date,
    updatedAt: data.updated,
    legacyRssGuid: asOptionalUrlString(data.legacyRssGuid),
  };
}
