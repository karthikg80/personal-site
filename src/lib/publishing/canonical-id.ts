import { generateObjectId } from '../../core/authoring/generate-object-id.js';
import { parseObjectIdV7 } from '../../core/domain/ids.js';

export function ensureCanonicalId(existing: string | undefined): string {
  if (existing == null || existing.trim() === '') {
    return generateObjectId();
  }
  return parseObjectIdV7(existing);
}
