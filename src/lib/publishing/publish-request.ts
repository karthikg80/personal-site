import { parseObjectIdV7 } from '../../core/domain/ids.js';
import { contentSlugSchema } from '../../core/storage/slug-schema.js';
import { noteRepoPath } from './note-path.js';

const PUBLISH_KEYS = new Set(['objectId', 'slug', 'expectedBlobSha']);
const GIT_BLOB_SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

export type ParsedPublish = {
  objectId: string;
  slug: string;
  expectedBlobSha: string;
};

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Publish request must be a JSON object.');
  }
  return input as Record<string, unknown>;
}

function parseSlug(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Slug must be a single URL segment.');
  }
  try {
    const slug = contentSlugSchema.parse(value.trim());
    noteRepoPath(slug);
    return slug;
  } catch (error) {
    if (error instanceof Error && /reserved/i.test(error.message)) {
      throw error;
    }
    throw new Error('Slug must be a single URL segment.');
  }
}

export function parsePublishRequest(input: unknown): ParsedPublish {
  const record = asRecord(input);

  if ('privacyAcknowledgement' in record) {
    throw new Error('Privacy acknowledgement is not accepted on Publish.');
  }

  const unknownKeys = Object.keys(record).filter((key) => !PUBLISH_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown Publish field: ${unknownKeys[0]}.`);
  }

  let objectId: string;
  try {
    objectId = parseObjectIdV7(typeof record.objectId === 'string' ? record.objectId : '');
  } catch {
    throw new Error('ObjectId must be UUIDv7.');
  }

  if (typeof record.expectedBlobSha !== 'string' || !GIT_BLOB_SHA.test(record.expectedBlobSha.trim())) {
    throw new Error('expectedBlobSha must be a Git blob SHA.');
  }

  return {
    objectId,
    slug: parseSlug(record.slug),
    expectedBlobSha: record.expectedBlobSha.trim().toLowerCase(),
  };
}
