import { parseObjectIdV7 } from '../../core/domain/ids.js';
import { noteRelationshipSchema } from '../../core/storage/note-relationship-schema.js';
import { contentSlugSchema } from '../../core/storage/slug-schema.js';
import { ensureCanonicalId } from './canonical-id.js';
import { parseDistributionIntent } from './distribution-intent.js';
import { serializePreparedNote, type CanonicalNoteFields } from './note-markdown.js';
import { noteRepoPath } from './note-path.js';

const PREPARE_KEYS = new Set([
  'canonicalId',
  'slug',
  'title',
  'date',
  'tags',
  'presentation',
  'summary',
  'relationships',
  'body',
  'sparks',
  'privacyAcknowledgement',
  'distribution',
]);

export type PrepareRequest = {
  canonicalId?: string;
  slug: string;
  title: string;
  date: string;
  tags?: string[];
  presentation?: 'note' | 'scrap';
  summary?: string;
  relationships?: CanonicalNoteFields['relationships'];
  body?: string;
  sparks?: string;
  privacyAcknowledgement: true;
  distribution?: { webmentions: boolean; bluesky: boolean };
};

export type ParsedPrepare = {
  privacyAcknowledgement: true;
  canonicalId: string;
  slug: string;
  markdown: string;
};

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Prepare request must be a JSON object.');
  }
  return input as Record<string, unknown>;
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseUtcDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date must be YYYY-MM-DD.');
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('Date must be YYYY-MM-DD.');
  }
  return value;
}

function parseTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('tags must be an array of strings.');
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`tags[${index}] must be a non-empty string.`);
    }
    return entry.trim();
  });
}

function parsePresentation(value: unknown): 'note' | 'scrap' {
  if (value === undefined || value === 'note') return 'note';
  if (value === 'scrap') return 'scrap';
  throw new Error('presentation must be note or scrap.');
}

function parseRelationships(value: unknown): CanonicalNoteFields['relationships'] {
  try {
    const relationships = noteRelationshipSchema.parse(value ?? []);
    if (relationships.some((relationship) => relationship.target.kind === 'internal')) {
      throw new Error('Internal relationships are not accepted on Prepare.');
    }
    return relationships;
  } catch (error) {
    if (error instanceof Error && error.message === 'Internal relationships are not accepted on Prepare.') {
      throw error;
    }
    throw new Error('Relationship URL is not valid.');
  }
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

export function parsePrepareRequest(input: unknown): ParsedPrepare {
  const record = asRecord(input);

  if ('draft' in record || 'privacyReviewed' in record) {
    throw new Error('Publication flags are not accepted on Prepare.');
  }

  const unknownKeys = Object.keys(record).filter((key) => !PREPARE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown Prepare field: ${unknownKeys[0]}.`);
  }

  if (record.privacyAcknowledgement !== true) {
    throw new Error(
      'Privacy acknowledgement is required before this text can enter the public repository.'
    );
  }

  const title = optionalString(record.title).trim();
  if (!title) {
    throw new Error('Title is required.');
  }

  const body = optionalString(record.body).trim() || optionalString(record.sparks).trim();
  if (!body) {
    throw new Error('Add a draft body.');
  }

  let canonicalId: string;
  try {
    canonicalId = record.canonicalId === undefined
      ? ensureCanonicalId(undefined)
      : parseObjectIdV7(optionalString(record.canonicalId));
  } catch {
    throw new Error('ObjectId must be UUIDv7.');
  }

  const slug = parseSlug(record.slug);
  const summary = optionalString(record.summary).trim() || undefined;

  const markdown = serializePreparedNote({
    id: canonicalId,
    slug,
    title,
    date: parseUtcDate(record.date),
    tags: parseTags(record.tags),
    presentation: parsePresentation(record.presentation),
    summary,
    relationships: parseRelationships(record.relationships),
    distribution: parseDistributionIntent(record.distribution),
    body,
  });

  return {
    privacyAcknowledgement: true,
    canonicalId,
    slug,
    markdown,
  };
}
