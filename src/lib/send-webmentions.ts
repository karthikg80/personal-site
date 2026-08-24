import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverWebmentionEndpoint, sendWebmention } from '../adapters/webmention/discovery.js';
import { extractOutboundLinks, markdownToLinkHtml } from '../adapters/webmention/outbound-targets.js';
import { derivePublicationState, isPublicPublication } from '../core/domain/publication.js';

const SITE = 'https://karthikg.in';
const NOTES_DIR = fileURLToPath(new URL('../../src/content/notes', import.meta.url));

type Frontmatter = {
  draft?: boolean;
  privacyReviewed?: boolean;
  inReplyTo?: string;
  bookmarkOf?: string;
};

function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Frontmatter = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    const value = rest.join(':').trim().replace(/^['"]|['"]$/g, '');
    if (key === 'draft') data.draft = value === 'true';
    if (key === 'privacyReviewed') data.privacyReviewed = value === 'true';
    if (key === 'inReplyTo') data.inReplyTo = value;
    if (key === 'bookmarkOf') data.bookmarkOf = value;
  }

  return { data, body: match[2] };
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

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const files = (await readdir(NOTES_DIR)).filter((file) => file.endsWith('.md'));
  let sent = 0;

  for (const file of files) {
    const raw = await readFile(join(NOTES_DIR, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const publication = derivePublicationState(data.draft ?? true, data.privacyReviewed ?? false);
    if (!isPublicPublication(publication)) {
      continue;
    }

    const slug = file.replace(/\.md$/, '');
    const source = `${SITE}/notes/${slug}/`;
    const targets = extractOutboundLinks(markdownToLinkHtml(body), SITE, {
      inReplyTo: data.inReplyTo,
      bookmarkOf: data.bookmarkOf,
    });

    for (const target of targets) {
      const endpoint = await discover(target).catch(() => null);
      if (!endpoint) {
        console.log(`skip ${source} → ${target} (no endpoint)`);
        continue;
      }

      if (dryRun) {
        console.log(`dry-run ${source} → ${target} via ${endpoint}`);
        continue;
      }

      const status = await sendWebmention(endpoint, source, target);
      console.log(`${status} ${source} → ${target}`);
      sent += 1;
    }
  }

  console.log(dryRun ? 'dry-run complete' : `sent ${sent} webmention${sent === 1 ? '' : 's'}`);
}

await main();
