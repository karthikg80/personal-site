import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('IndieWebify / Bridgy markup contracts', () => {
  it('keeps note h-entry author and syndication attrs Bridgy-ready', () => {
    const layout = read('src/layouts/NoteLayout.astro');
    expect(layout).toContain('class="p-author h-card author"');
    expect(layout).toContain('rel="author"');
    expect(layout).toContain('personAvatarUrl(person)');
    expect(layout).toMatch(/class="u-syndication"\s+rel="syndication"/);
  });

  it('keeps homepage h-card photo absolute via personAvatarUrl', () => {
    const home = read('src/pages/index.astro');
    expect(home).toContain('personAvatarUrl(person)');
    expect(home).toContain('class="u-photo u-logo avatar"');
    expect(home).toContain('class="intro-copy h-card"');
  });

  it('documents Bridgy, IndieWebify, and wiki paste steps', () => {
    const docs = read('docs/indieweb.md');
    expect(docs).toContain('brid.gy');
    expect(docs).toContain('indiewebify.me');
    expect(docs).toContain('User:Karthikg.in');
    expect(docs).toContain('{{Infobox person');

    const colophon = read('src/pages/colophon.astro');
    expect(colophon).toContain('brid.gy');
    expect(colophon).toContain('indiewebify.me');
    expect(colophon).toContain('User:Karthikg.in');
  });
});
