import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderNoteBodyHtml } from './note-body-html.js';

const fixtures = join(import.meta.dirname, 'fixtures');
const repoRoot = join(import.meta.dirname, '../../..');

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), 'utf8');
}

function splitMarkdownBody(raw: string): string {
  return raw.replace(/^---[\s\S]*?---\n/, '');
}

/** Trailing newline from the processor vs HTML slot is not a semantic difference. */
function normalizeBodyHtml(html: string): string {
  return html.replace(/^\n+|\n+$/g, '');
}

describe('renderNoteBodyHtml', () => {
  it('declares @astrojs/markdown-satteri as a direct dependency', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.['@astrojs/markdown-satteri']).toMatch(/0\.3/);
  });

  it('matches production render(entry) HTML for the public first note', async () => {
    const markdown = splitMarkdownBody(
      readFileSync(join(import.meta.dirname, '../../content/notes/first-note-probably.md'), 'utf8')
    );
    const expected = fixture('first-note-probably.body.html');
    const actual = await renderNoteBodyHtml(markdown);
    expect(normalizeBodyHtml(actual)).toBe(normalizeBodyHtml(expected));
  });

  it('matches production render(entry) HTML for headings, links, emphasis, lists, code, quotes, and raw HTML', async () => {
    const markdown = fixture('markdown-constructs.md');
    const expected = fixture('markdown-constructs.body.html');
    const actual = await renderNoteBodyHtml(markdown);
    expect(normalizeBodyHtml(actual)).toBe(normalizeBodyHtml(expected));
  });

  it('refuses local Astro image-pipeline paths instead of rendering a divergent HTML', async () => {
    await expect(renderNoteBodyHtml('![a cat](./cat.jpg)\n')).rejects.toThrow(/local image/i);
  });

  it('allows remote images', async () => {
    const html = await renderNoteBodyHtml('![a cat](https://example.com/cat.jpg)\n');
    expect(html).toContain('https://example.com/cat.jpg');
  });
});
