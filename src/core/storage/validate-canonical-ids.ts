import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { assertUniqueObjectIds, parseObjectId, type ObjectId } from '../domain/ids.js';

const CONTENT_ROOT = join(import.meta.dirname, '../../content');

type ParsedFrontmatter = Record<string, unknown>;

function splitFrontmatter(raw: string): { frontmatter: ParsedFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing YAML frontmatter.');
  }
  const frontmatter = parseYaml(match[1]);
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error('Frontmatter must be a YAML mapping.');
  }
  return { frontmatter: frontmatter as ParsedFrontmatter, body: match[2] };
}

function readMarkdownFile(path: string): ParsedFrontmatter {
  return splitFrontmatter(readFileSync(path, 'utf8')).frontmatter;
}

function readPersonFile(): ParsedFrontmatter {
  const path = join(CONTENT_ROOT, 'person.yaml');
  if (!existsSync(path)) {
    throw new Error('Missing src/content/person.yaml');
  }
  const data = parseYaml(readFileSync(path, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('person.yaml must be a mapping.');
  }
  return data as ParsedFrontmatter;
}

function listMarkdown(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name));
}

function requireString(record: ParsedFrontmatter, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is missing ${key}.`);
  }
  return value.trim();
}

function requireStringArray(record: ParsedFrontmatter, key: string, label: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`${label} must include ${key} as an array.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`${label} ${key}[${index}] must be a non-empty string.`);
    }
    return entry.trim();
  });
}

function isPublicNote(record: ParsedFrontmatter): boolean {
  return record.draft === false && record.privacyReviewed === true;
}

export type CanonicalIdentityRecord = {
  kind: 'person' | 'note' | 'project';
  label: string;
  id: ObjectId;
  slug?: string;
  previousSlugs: string[];
  legacyRssGuid?: string;
};

export function loadCanonicalIdentityRecords(): CanonicalIdentityRecord[] {
  const records: CanonicalIdentityRecord[] = [];

  const person = readPersonFile();
  records.push({
    kind: 'person',
    label: 'person.yaml',
    id: parseObjectId(requireString(person, 'id', 'person.yaml')),
    previousSlugs: [],
  });

  for (const path of listMarkdown(join(CONTENT_ROOT, 'notes'))) {
    const frontmatter = readMarkdownFile(path);
    const label = `note ${path.split('/').pop()}`;
    const slug = requireString(frontmatter, 'slug', label);
    const previousSlugs = requireStringArray(frontmatter, 'previousSlugs', label);
    const legacy = frontmatter.legacyRssGuid;
    records.push({
      kind: 'note',
      label,
      id: parseObjectId(requireString(frontmatter, 'id', label)),
      slug,
      previousSlugs,
      legacyRssGuid: typeof legacy === 'string' ? legacy : undefined,
    });
  }

  for (const path of listMarkdown(join(CONTENT_ROOT, 'projects'))) {
    const frontmatter = readMarkdownFile(path);
    const label = `project ${path.split('/').pop()}`;
    const slug = requireString(frontmatter, 'slug', label);
    const previousSlugs = requireStringArray(frontmatter, 'previousSlugs', label);
    records.push({
      kind: 'project',
      label,
      id: parseObjectId(requireString(frontmatter, 'id', label)),
      slug,
      previousSlugs,
    });
  }

  return records;
}

export function validateCanonicalIdentities(): void {
  const records = loadCanonicalIdentityRecords();
  assertUniqueObjectIds(records.map((record) => record.id));

  const noteOccupied = new Map<string, string>();
  const projectOccupied = new Map<string, string>();

  for (const record of records) {
    if (record.kind === 'note' || record.kind === 'project') {
      const slug = record.slug!;
      const occupied = record.kind === 'note' ? noteOccupied : projectOccupied;

      claimSlug(occupied, slug, `${record.label} current slug`);

      const seenPrevious = new Set<string>();
      for (const previous of record.previousSlugs) {
        if (previous === slug) {
          throw new Error(`${record.label}: previousSlugs must not include current slug ${slug}`);
        }
        if (seenPrevious.has(previous)) {
          throw new Error(`${record.label}: duplicate previousSlugs entry ${previous}`);
        }
        seenPrevious.add(previous);
        claimSlug(occupied, previous, `${record.label} previousSlugs`);
      }
    }

    if (record.kind === 'note') {
      const frontmatterPath = record.label.replace(/^note /, '');
      const frontmatter = readMarkdownFile(join(CONTENT_ROOT, 'notes', frontmatterPath));
      const isPublic = isPublicNote(frontmatter);

      if (record.legacyRssGuid) {
        const allowedSlugs = new Set([record.slug!, ...record.previousSlugs]);
        const match = record.legacyRssGuid.match(/^https:\/\/karthikg\.in\/notes\/([^/]+)\/$/);
        if (!match || !allowedSlugs.has(match[1]!)) {
          throw new Error(
            `${record.label}: legacyRssGuid must be a karthikg.in/notes/<slug>/ URL for this note's current or previous slug`
          );
        }
        if (!isPublic) {
          throw new Error(`${record.label}: legacyRssGuid is only allowed on public notes.`);
        }
      } else if (isPublic) {
        throw new Error(`${record.label}: public note must include legacyRssGuid.`);
      }
    }
  }
}

function claimSlug(occupied: Map<string, string>, slug: string, claimant: string): void {
  const existing = occupied.get(slug);
  if (existing) {
    throw new Error(`Slug collision for "${slug}": ${existing} vs ${claimant}`);
  }
  occupied.set(slug, claimant);
}

export function collectMigrationSnapshot() {
  const records = loadCanonicalIdentityRecords();
  return {
    noteSlugs: records.filter((r) => r.kind === 'note').map((r) => r.slug!).sort(),
    projectSlugs: records.filter((r) => r.kind === 'project').map((r) => r.slug!).sort(),
    publishedNoteSlugs: records
      .filter((r) => r.kind === 'note' && r.legacyRssGuid)
      .map((r) => r.slug!)
      .sort(),
    legacyRssGuids: records
      .filter((r) => r.legacyRssGuid)
      .map((r) => ({ slug: r.slug!, guid: r.legacyRssGuid! }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}
