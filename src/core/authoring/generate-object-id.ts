import { v7 } from 'uuid';

import { parseObjectIdV7, type ObjectId } from '../domain/ids.js';

/** Assign at authoring or explicit migration time only — never during content load/build. */
export function generateObjectId(): ObjectId {
  return parseObjectIdV7(v7());
}
