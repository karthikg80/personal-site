import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { isPublicNote } from '../../core/domain/note.js';
import { mapNote } from '../../core/storage/map-note.js';
import { buildHandoffMarkdown } from './handoff.js';
import { parseCanonicalNoteFile, publishCanonicalNote } from './note-markdown.js';
import { parsePrepareRequest } from './prepare-request.js';

const objectId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
const slug = 'building-for-the-web-of-2030';
const body = 'The body must survive Prepare and Publish.\n\nSecond paragraph.\n';
const replyUrl = 'https://example.com/post';
const syndicationUrl = 'https://bsky.app/profile/karthikg.in/post/3examplepost';

const prepareInput = {
  canonicalId: objectId,
  slug,
  title: 'Building for the web of 2030',
  date: '2026-08-24',
  tags: ['making'],
  presentation: 'note' as const,
  relationships: [
    {
      type: 'reply-to' as const,
      target: { kind: 'external' as const, url: replyUrl },
    },
  ],
  body,
  privacyAcknowledgement: true as const,
};

const repoRoot = join(import.meta.dirname, '../../..');

function mapFromCanonicalMarkdown(raw: string) {
  const parsed = parseCanonicalNoteFile(raw);
  const yamlMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!yamlMatch) throw new Error('Expected YAML frontmatter');
  const data = parseYaml(yamlMatch[1]) as {
    previousSlugs?: string[];
    syndication?: string[];
  };

  const note = mapNote({
    id: parsed.fields.id,
    slug: parsed.fields.slug,
    previousSlugs: data.previousSlugs ?? [],
    title: parsed.fields.title,
    summary: parsed.fields.summary,
    presentation: parsed.fields.presentation,
    tags: parsed.fields.tags,
    draft: parsed.draft,
    privacyReviewed: parsed.privacyReviewed,
    relationships: parsed.fields.relationships,
    syndication: data.syndication ?? [],
    date: new Date(`${parsed.fields.date}T00:00:00.000Z`),
  });

  return { parsed, note, syndication: data.syndication ?? [] };
}

describe('editorial Prepare → unpublished → Publish transition', () => {
  it('Prepare stays unpublished; Publish flips only draft; Copy/Download stays closed', () => {
    const prepared = parsePrepareRequest(prepareInput);
    expect(prepared.markdown).toMatch(/^draft: true$/m);
    expect(prepared.markdown).toMatch(/^privacyReviewed: true$/m);
    expect(prepared.markdown).not.toMatch(/legacyRssGuid/);

    const afterPrepare = mapFromCanonicalMarkdown(prepared.markdown);
    expect(afterPrepare.parsed.draft).toBe(true);
    expect(afterPrepare.parsed.privacyReviewed).toBe(true);
    expect(afterPrepare.note.publication).toBe('draft');
    expect(isPublicNote(afterPrepare.note)).toBe(false);
    expect(prepared.markdown).toMatch(/webmentions: false/);

    const handoff = buildHandoffMarkdown({
      canonicalId: objectId,
      title: prepareInput.title,
      slug,
      date: prepareInput.date,
      body,
    });
    expect(handoff.content).toMatch(/^draft: true$/m);
    expect(handoff.content).toMatch(/^privacyReviewed: false$/m);
    expect(handoff.content).not.toMatch(/privacyReviewed: true/);

    const unpublishedWithSyndication = prepared.markdown.replace(
      /^syndication: \[\]$/m,
      `syndication:\n  - ${syndicationUrl}`
    );
    const published = publishCanonicalNote(unpublishedWithSyndication);
    const afterPublish = mapFromCanonicalMarkdown(published);

    expect(afterPublish.parsed.draft).toBe(false);
    expect(afterPublish.parsed.privacyReviewed).toBe(true);
    expect(afterPublish.parsed.fields.id).toBe(objectId);
    expect(afterPublish.parsed.fields.slug).toBe(slug);
    expect(afterPublish.parsed.body).toBe(afterPrepare.parsed.body);
    expect(afterPublish.parsed.fields.relationships).toEqual(afterPrepare.parsed.fields.relationships);
    expect(afterPublish.syndication).toEqual([syndicationUrl]);
    expect(published).toMatch(/^privacyReviewed: true$/m);
    expect(published).not.toMatch(/^draft: true$/m);

    expect(afterPublish.note.publication).toBe('public');
    expect(isPublicNote(afterPublish.note)).toBe(true);
    expect(afterPublish.note.id).toBe(afterPrepare.note.id);
    expect(afterPublish.note.slug).toBe(afterPrepare.note.slug);
    expect(afterPublish.note.relationships).toEqual(afterPrepare.note.relationships);
  });
});

describe('public surfaces use the publication predicate', () => {
  it('routes, RSS, and sitemap read published notes only', () => {
    const storage = readFileSync(join(repoRoot, 'src/core/storage/content.ts'), 'utf8');
    expect(storage).toContain('filter((record) => isPublicNote(record.note))');

    const noteRoute = readFileSync(join(repoRoot, 'src/pages/notes/[...slug].astro'), 'utf8');
    expect(noteRoute).toContain('getPublishedNotes');
    expect(noteRoute).toContain('await render(note)');

    const archive = readFileSync(join(repoRoot, 'src/pages/notes/index.astro'), 'utf8');
    expect(archive).toContain('getPublishedNotes');

    const home = readFileSync(join(repoRoot, 'src/pages/index.astro'), 'utf8');
    expect(home).toContain('getPublishedNotes');

    const rss = readFileSync(join(repoRoot, 'src/pages/rss.xml.ts'), 'utf8');
    expect(rss).toContain('getPublishedNoteRecords');

    const sitemap = readFileSync(join(repoRoot, 'src/pages/sitemap.xml.ts'), 'utf8');
    expect(sitemap).toContain('getPublishedNotes');
    expect(sitemap).not.toContain('/drafting');
  });
});

describe('agent and distribution stay off the mutation path', () => {
  it('the agent route has no Prepare or Publish capability', () => {
    const agent = readFileSync(join(repoRoot, 'src/pages/api/drafting/agent.ts'), 'utf8');
    expect(agent).not.toContain('executePrepare');
    expect(agent).not.toContain('executePublish');
    expect(agent).not.toContain('putNoteFile');
    expect(agent).not.toContain('GITHUB_NOTES_TOKEN');
    expect(agent).toContain('Nothing you produce is approved for publication');
  });

  it('Webmention and Bluesky stay off Prepare/Publish; distribution is a later Action', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['webmentions:send']).toBe('tsx src/lib/send-webmentions.ts');
    expect(pkg.scripts['posse:bluesky']).toBe('tsx src/lib/posse-bluesky.ts');

    const prepare = readFileSync(join(repoRoot, 'src/lib/publishing/prepare-flow.ts'), 'utf8');
    const publish = readFileSync(join(repoRoot, 'src/lib/publishing/publish-flow.ts'), 'utf8');
    const publishClient = readFileSync(join(repoRoot, 'src/scripts/drafting-publish.ts'), 'utf8');
    for (const source of [prepare, publish, publishClient]) {
      expect(source).not.toMatch(/webmention|bluesky|posse/i);
    }

    const webmentions = readFileSync(join(repoRoot, 'src/lib/webmentions/send-outbound.ts'), 'utf8');
    const bluesky = readFileSync(join(repoRoot, 'src/lib/syndication/bluesky.ts'), 'utf8');
    expect(webmentions).toContain('isPublicPublication');
    expect(bluesky).toContain('isPublicPublication');
    expect(webmentions).toContain('--slug=');
    expect(bluesky).toContain('putRecord');
  });
});
