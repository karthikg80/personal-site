import type { ObjectId } from './ids.js';

export type RelationshipType = 'reply-to' | 'bookmark-of';

export type RelationshipTarget =
  | {
      kind: 'internal';
      id: ObjectId;
      expectedKind?: 'note' | 'project';
    }
  | {
      kind: 'external';
      url: string;
    };

export interface Relationship {
  type: RelationshipType;
  target: RelationshipTarget;
}

export function findRelationships(
  relationships: Relationship[],
  type: RelationshipType
): Relationship[] {
  return relationships.filter((relationship) => relationship.type === type);
}

export function findRelationship(
  relationships: Relationship[],
  type: RelationshipType
): Relationship | undefined {
  return findRelationships(relationships, type)[0];
}

/** External target URLs only — used by adapters, not presentation markup. */
export function externalRelationshipUrls(relationships: Relationship[]): string[] {
  const urls: string[] = [];
  for (const relationship of relationships) {
    if (relationship.target.kind === 'external') {
      urls.push(relationship.target.url);
    }
  }
  return urls;
}
