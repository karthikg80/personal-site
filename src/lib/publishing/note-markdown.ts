import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { parseObjectIdV7 } from '../../core/domain/ids.js';
import type { RelationshipStorage } from '../../core/storage/map-note.js';
import { noteRelationshipSchema } from '../../core/storage/note-relationship-schema.js';

export type CanonicalNoteFields = {
  id: string;
  slug: string;
  title: string;
  date: string;
  tags: string[];
  presentation: 'note' | 'scrap';
  summary?: string;
  relationships: RelationshipStorage[];
  body: string;
};

function splitFrontmatter(raw: string): { yaml: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing YAML frontmatter.');
  }
  return { yaml: match[1]!, body: match[2] ?? '' };
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean.`);
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`${key}[${index}] must be a non-empty string.`);
    }
    return entry.trim();
  });
}

function asDateString(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  throw new Error('date is required.');
}

export function serializePreparedNote(fields: CanonicalNoteFields): string {
  const id = parseObjectIdV7(fields.id);
  const frontmatter: Record<string, unknown> = {
    id,
    title: fields.title,
    slug: fields.slug,
    date: fields.date,
    previousSlugs: [],
  };
  if (fields.summary?.trim()) {
    frontmatter.summary = fields.summary.trim();
  }
  frontmatter.tags = fields.tags;
  frontmatter.presentation = fields.presentation;
  frontmatter.relationships = fields.relationships;
  frontmatter.syndication = [];
  frontmatter.draft = true;
  frontmatter.privacyReviewed = true;

  return `---\n${stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n${fields.body}`;
}

export function parseCanonicalNoteFile(raw: string): {
  fields: CanonicalNoteFields;
  draft: boolean;
  privacyReviewed: boolean;
  body: string;
} {
  const { yaml, body } = splitFrontmatter(raw);
  const parsed = parseYaml(yaml);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter must be a YAML mapping.');
  }
  const record = parsed as Record<string, unknown>;
  const presentation = requireString(record, 'presentation');
  if (presentation !== 'note' && presentation !== 'scrap') {
    throw new Error('presentation must be note or scrap.');
  }

  const summaryValue = record.summary;
  const summary =
    typeof summaryValue === 'string' && summaryValue.trim() ? summaryValue.trim() : undefined;

  const fields: CanonicalNoteFields = {
    id: parseObjectIdV7(requireString(record, 'id')),
    slug: requireString(record, 'slug'),
    title: requireString(record, 'title'),
    date: asDateString(record.date),
    tags: requireStringArray(record, 'tags'),
    presentation,
    summary,
    relationships: noteRelationshipSchema.parse(record.relationships ?? []),
    body,
  };

  return {
    fields,
    draft: requireBoolean(record, 'draft'),
    privacyReviewed: requireBoolean(record, 'privacyReviewed'),
    body,
  };
}

export function publishCanonicalNote(raw: string): string {
  const parsed = parseCanonicalNoteFile(raw);
  if (parsed.privacyReviewed !== true) {
    throw new Error('privacyReviewed must be true before Publish.');
  }
  if (parsed.draft !== true) {
    throw new Error('Note is already public.');
  }

  const match = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n)?)([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing YAML frontmatter.');
  }
  const nextFrontmatter = match[2]!.replace(/^draft:\s*true\s*$/m, 'draft: false');
  if (nextFrontmatter === match[2]) {
    throw new Error('Could not flip draft.');
  }
  return `${match[1]}${nextFrontmatter}${match[3]}${match[4]}`;
}
