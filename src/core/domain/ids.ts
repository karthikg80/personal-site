import { validate as validateUuid, version as uuidVersion } from 'uuid';

export type ObjectId = string & { readonly __brand: 'ObjectId' };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidShape(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseObjectId(value: string): ObjectId {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('ObjectId is required.');
  }
  if (!validateUuid(trimmed)) {
    throw new Error(`Invalid ObjectId: ${value}`);
  }
  return trimmed as ObjectId;
}

export function parseObjectIdV7(value: string): ObjectId {
  const id = parseObjectId(value);
  if (uuidVersion(id) !== 7) {
    throw new Error(`ObjectId must be UUIDv7: ${value}`);
  }
  return id;
}

export function assertUniqueObjectIds(ids: ObjectId[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ObjectId: ${id}`);
    }
    seen.add(id);
  }
}
