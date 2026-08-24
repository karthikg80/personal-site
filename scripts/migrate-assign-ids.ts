import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { generateObjectId } from '../src/core/authoring/generate-object-id.js';
import { parseObjectId } from '../src/core/domain/ids.js';

const SITE = 'https://karthikg.in';
const CONTENT = join(import.meta.dirname, '../src/content');
const NOTES_DIR = join(CONTENT, 'notes');
const PROJECTS_DIR = join(CONTENT, 'projects');
const PERSON_PATH = join(CONTENT, 'person.yaml');
const MIGRATION_LOG = join(import.meta.dirname, '../docs/migration/id-assignment-log.json');

const dryRun = process.argv.includes('--dry-run');

type Frontmatter = Record<string, unknown>;

function splitFrontmatter(raw: string): { frontmatter: Frontmatter; body: string; prefix: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('Missing frontmatter block.');
  return { frontmatter: parseYaml(match[1]) as Frontmatter, body: match[2], prefix: '---\n' };
}

function serializeFrontmatter(frontmatter: Frontmatter, body: string): string {
  return `---\n${stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n${body}`;
}

function isPublicNote(data: Frontmatter): boolean {
  return data.draft === false && data.privacyReviewed === true;
}

function stem(filename: string): string {
  return filename.replace(/\.md$/, '');
}

function migrateMarkdownFile(path: string, collection: 'notes' | 'projects'): { changed: boolean; id: string } {
  const raw = readFileSync(path, 'utf8');
  const filename = path.split('/').pop()!;
  const slug = stem(filename);
  const { frontmatter, body } = splitFrontmatter(raw);

  let changed = false;
  let id: string;

  if (typeof frontmatter.id === 'string' && frontmatter.id.trim()) {
    id = parseObjectId(frontmatter.id);
  } else {
    id = generateObjectId();
    frontmatter.id = id;
    changed = true;
  }

  if (typeof frontmatter.slug !== 'string' || !frontmatter.slug.trim()) {
    frontmatter.slug = slug;
    changed = true;
  }

  if (!Array.isArray(frontmatter.previousSlugs)) {
    frontmatter.previousSlugs = [];
    changed = true;
  }

  if (collection === 'notes' && isPublicNote(frontmatter)) {
    const expectedGuid = `${SITE}/notes/${String(frontmatter.slug)}/`;
    if (frontmatter.legacyRssGuid !== expectedGuid) {
      frontmatter.legacyRssGuid = expectedGuid;
      changed = true;
    }
  }

  if (!dryRun && changed) {
    writeFileSync(path, serializeFrontmatter(frontmatter, body));
  }

  return { changed, id };
}

function createPersonIfMissing(): { changed: boolean; id: string } {
  if (existsSync(PERSON_PATH)) {
    const data = parseYaml(readFileSync(PERSON_PATH, 'utf8')) as Frontmatter;
    return { changed: false, id: parseObjectId(String(data.id)) };
  }

  const id = generateObjectId();
  const person = {
    id,
    siteUrl: SITE,
    name: 'Karthik Gurumoorthy',
    tagline:
      'I build useful software for families and everyday life. Founder of Thea Foundry, after 18 years on high-scale payments systems.',
    avatarPath: '/avatar.svg',
    organization: { name: 'Thea Foundry', url: 'https://theafoundry.com' },
    contactMethods: [{ kind: 'email', value: 'karthi@hey.com', rel: ['me'] }],
    externalIdentities: [
      { kind: 'github', label: 'GitHub', url: 'https://github.com/karthikg80', rel: ['me'] },
      {
        kind: 'atproto',
        label: 'Bluesky',
        url: 'https://bsky.app/profile/karthikg.in',
        rel: ['me', 'atproto'],
        identifiers: { handle: 'karthikg.in', did: 'did:plc:k25m3ebqwdr32ojecqpjfzbh' },
      },
      {
        kind: 'linkedin',
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/in/karthikg80/',
        rel: ['me'],
      },
      { kind: 'website', label: 'Thea Foundry', url: 'https://theafoundry.com', rel: ['me'] },
    ],
    interests: ['personal web', 'calm software', 'household tools'],
  };

  if (!dryRun) {
    writeFileSync(PERSON_PATH, `${stringifyYaml(person).trimEnd()}\n`);
  }

  return { changed: true, id };
}

function main(): void {
  const notes = readdirSync(NOTES_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((file) => ({ file, ...migrateMarkdownFile(join(NOTES_DIR, file), 'notes') }));

  const projects = readdirSync(PROJECTS_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((file) => ({ file, ...migrateMarkdownFile(join(PROJECTS_DIR, file), 'projects') }));

  const person = createPersonIfMissing();

  const changedCount =
    notes.filter((entry) => entry.changed).length +
    projects.filter((entry) => entry.changed).length +
    (person.changed ? 1 : 0);

  const legacyRssGuidCount = notes.filter(
    (entry) => entry.file === 'first-note-probably.md' && entry.changed
  ).length;

  if (!dryRun && changedCount > 0) {
    mkdirSync(join(import.meta.dirname, '../docs/migration'), { recursive: true });
    writeFileSync(
      MIGRATION_LOG,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), notes, projects, person }, null, 2)}\n`
    );
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        changedCount,
        notes: notes.length,
        projects: projects.length,
        legacyPublicNotes: notes.filter((entry) => entry.file === 'first-note-probably.md').length,
        person,
      },
      null,
      2
    )
  );
}

main();
