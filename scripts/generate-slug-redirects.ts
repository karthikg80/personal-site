import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  deriveSlugRedirects,
  renderSlugRedirectModule,
  type Sluggable,
} from '../src/adapters/routing/slug-redirects.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOTES_DIR = join(ROOT, 'src/content/notes');
const PROJECTS_DIR = join(ROOT, 'src/content/projects');
const OUTPUT = join(ROOT, 'src/generated/slug-redirects.mjs');

type Frontmatter = Record<string, unknown>;

function splitFrontmatter(raw: string): Frontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('Missing YAML frontmatter');
  }
  const data = parseYaml(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Frontmatter must be a YAML mapping');
  }
  return data as Frontmatter;
}

function loadSluggables(dir: string, kind: 'note' | 'project'): Sluggable[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const frontmatter = splitFrontmatter(readFileSync(join(dir, name), 'utf8'));
      const slug = frontmatter.slug;
      const previousSlugs = frontmatter.previousSlugs;
      if (typeof slug !== 'string' || !slug) {
        throw new Error(`${kind} ${name} is missing slug`);
      }
      if (!Array.isArray(previousSlugs)) {
        throw new Error(`${kind} ${name} is missing previousSlugs array`);
      }
      return {
        slug,
        previousSlugs: previousSlugs.map((entry, index) => {
          if (typeof entry !== 'string' || !entry) {
            throw new Error(`${kind} ${name} previousSlugs[${index}] must be a non-empty string`);
          }
          return entry;
        }),
        label: `${kind} ${name}`,
      };
    });
}

function main(): void {
  const notes = loadSluggables(NOTES_DIR, 'note');
  const projects = loadSluggables(PROJECTS_DIR, 'project');
  const redirects = deriveSlugRedirects({ notes, projects });
  const contents = renderSlugRedirectModule(redirects);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, contents);
  console.log(`Wrote ${OUTPUT} (${redirects.length} redirects)`);
}

main();
