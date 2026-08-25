import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { discoverWebmentionEndpoint, sendWebmention } from '../../adapters/webmention/discovery.js';
import { extractOutboundLinks, markdownToLinkHtml } from '../../adapters/webmention/outbound-targets.js';
import { derivePublicationState, isPublicPublication } from '../../core/domain/publication.js';
import type { RelationshipStorage } from '../../core/storage/map-note.js';
import { asUrlString } from '../../core/storage/url-value.js';

const SITE = 'https://karthikg.in';
const DEFAULT_NOTES_DIR = fileURLToPath(new URL('../../content/notes', import.meta.url));

type Frontmatter = {
  draft?: boolean;
  privacyReviewed?: boolean;
  relationships?: RelationshipStorage[];
};

export type WebmentionJob = {
  slug: string;
  source: string;
  targets: string[];
};

function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  return {
    data: parseYaml(match[1]) as Frontmatter,
    body: match[2],
  };
}

function externalUrlsFromFrontmatter(data: Frontmatter): string[] {
  const urls: string[] = [];
  for (const relationship of data.relationships ?? []) {
    if (relationship.target.kind === 'external') {
      urls.push(asUrlString(relationship.target.url));
    }
  }
  return urls;
}

export function webmentionJobsForNote(raw: string, slug: string): WebmentionJob | null {
  const { data, body } = parseFrontmatter(raw);
  const publication = derivePublicationState(data.draft ?? true, data.privacyReviewed ?? false);
  if (!isPublicPublication(publication)) return null;

  return {
    slug,
    source: `${SITE}/notes/${slug}/`,
    targets: extractOutboundLinks(
      markdownToLinkHtml(body),
      SITE,
      externalUrlsFromFrontmatter(data)
    ),
  };
}

async function discover(target: string): Promise<string | null> {
  const response = await fetch(target, {
    headers: { 'User-Agent': 'karthikg.in webmention sender' },
    redirect: 'follow',
  });
  const html = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return discoverWebmentionEndpoint({ target: response.url, headers, html });
}

export async function sendWebmentions(options: {
  slug?: string;
  dryRun?: boolean;
  notesDir?: string;
}): Promise<number> {
  const notesDir = options.notesDir ?? DEFAULT_NOTES_DIR;
  const files = options.slug
    ? [`${options.slug}.md`]
    : (await readdir(notesDir)).filter((file) => file.endsWith('.md') && file !== 'README.md');

  let sent = 0;
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const raw = await readFile(join(notesDir, file), 'utf8');
    const job = webmentionJobsForNote(raw, slug);
    if (!job) continue;

    for (const target of job.targets) {
      const endpoint = await discover(target).catch(() => null);
      if (!endpoint) {
        console.log(`skip ${job.source} → ${target} (no endpoint)`);
        continue;
      }

      if (options.dryRun) {
        console.log(`dry-run ${job.source} → ${target} via ${endpoint}`);
        continue;
      }

      const status = await sendWebmention(endpoint, job.source, target);
      console.log(`${status} ${job.source} → ${target}`);
      sent += 1;
    }
  }

  console.log(options.dryRun ? 'dry-run complete' : `sent ${sent} webmention${sent === 1 ? '' : 's'}`);
  return sent;
}

export function parseWebmentionCliArgs(argv: string[]): { slug?: string; dryRun: boolean } {
  const dryRun = argv.includes('--dry-run');
  const equals = argv.find((arg) => arg.startsWith('--slug='));
  const flagIndex = argv.indexOf('--slug');
  const raw = equals
    ? equals.slice('--slug='.length)
    : flagIndex >= 0
      ? argv[flagIndex + 1]
      : undefined;
  const slug = raw && !raw.startsWith('--') ? raw.replace(/\.md$/, '') : undefined;
  return { slug, dryRun };
}
