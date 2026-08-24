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
