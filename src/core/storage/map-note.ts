import { parseObjectId, type ObjectId } from '../domain/ids.js';
import type { Note } from '../domain/note.js';
import { derivePublicationState } from '../domain/publication.js';
import type { Relationship, RelationshipType } from '../domain/relationship.js';
import type { SyndicationCopy } from '../domain/syndication.js';
import { asOptionalUrlString, asUrlString } from './url-value.js';

export type RelationshipStorageTarget =
  | {
      kind: 'external';
      url: string | URL;
    }
  | {
      kind: 'internal';
      id: string;
      expectedKind?: 'note' | 'project';
    };

export type RelationshipStorage = {
  type: RelationshipType;
  target: RelationshipStorageTarget;
};

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
  relationships?: RelationshipStorage[];
  syndication: Array<string | URL>;
  legacyRssGuid?: string | URL;
  date: Date;
  updated?: Date;
};

function relationshipsFromStorage(data: NoteStorageData): Relationship[] {
  return (data.relationships ?? []).map((relationship) => {
    if (relationship.target.kind === 'external') {
      return {
        type: relationship.type,
        target: {
          kind: 'external',
          url: asUrlString(relationship.target.url),
        },
      };
    }

    return {
      type: relationship.type,
      target: {
        kind: 'internal',
        id: parseObjectId(relationship.target.id),
        expectedKind: relationship.target.expectedKind,
      },
    };
  });
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
