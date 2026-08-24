import { describe, expect, it } from 'vitest';

import { buildHandoffMarkdown } from './handoff.js';

const canonicalId = '018f3b2a-7c4e-7b3a-b123-456789abcdef';

function frontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error('Expected YAML frontmatter');
  }
  return match[1]!;
}

describe('buildHandoffMarkdown', () => {
  const input = {
    canonicalId,
    title: 'Building for the web of 2030',
    slug: 'building-for-the-web-of-2030',
    date: '2026-08-24',
    body: 'A sentence that belongs after the fence.\n\n## heading\n',
  };

  it('reuses canonicalId as frontmatter id', () => {
    const { content } = buildHandoffMarkdown(input);
    expect(frontmatter(content)).toMatch(/^id: 018f3b2a-7c4e-7b3a-b123-456789abcdef$/m);
  });

  it('produces the same id line across two builds with the same canonicalId', () => {
    const first = buildHandoffMarkdown(input);
    const second = buildHandoffMarkdown({ ...input, body: 'Different body' });
    const idLine = (markdown: string) =>
      frontmatter(markdown)
        .split('\n')
        .find((line) => line.startsWith('id: '));
    expect(idLine(first.content)).toBe(idLine(second.content));
  });

  it('always writes closed publication gates', () => {
    const { content } = buildHandoffMarkdown(input);
    const yaml = frontmatter(content);
    expect(yaml).toMatch(/^draft: true$/m);
    expect(yaml).toMatch(/^privacyReviewed: false$/m);
    expect(content).not.toMatch(/privacyReviewed: true/);
  });

  it('omits legacyRssGuid', () => {
    const { content } = buildHandoffMarkdown(input);
    expect(frontmatter(content)).not.toMatch(/legacyRssGuid/);
  });

  it('includes slug history and empty relationship/syndication arrays', () => {
    const { content, filename } = buildHandoffMarkdown(input);
    const yaml = frontmatter(content);
    expect(filename).toBe('building-for-the-web-of-2030.md');
    expect(yaml).toMatch(/^slug: "building-for-the-web-of-2030"$/m);
    expect(yaml).toMatch(/^previousSlugs: \[\]$/m);
    expect(yaml).toMatch(/^relationships: \[\]$/m);
    expect(yaml).toMatch(/^syndication: \[\]$/m);
  });

  it('preserves the Markdown body after the second fence', () => {
    const { content } = buildHandoffMarkdown(input);
    const body = content.split(/^---\n[\s\S]*?\n---\n/)[1];
    expect(body).toBe(`\n${input.body}\n`);
  });
});
