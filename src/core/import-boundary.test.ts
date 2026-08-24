import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(import.meta.dirname, '../..');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

function assertNoneMatch(files: string[], patterns: string[]): void {
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const relative = file.slice(srcRoot.length + 1);
    for (const pattern of patterns) {
      expect(source.includes(pattern), `${relative} must not contain ${pattern}`).toBe(false);
    }
  }
}

describe('import boundaries', () => {
  it('keeps core/domain free of adapters, Astro, and protocol modules', () => {
    const files = sourceFiles(join(import.meta.dirname, 'domain'));
    assertNoneMatch(files, [
      'astro:',
      "from 'astro",
      'from "astro',
      'adapters/',
      'webmention',
      'bluesky',
      'atproto',
      'pages/',
      'components/',
      'from \'../../adapters',
      'from "../../adapters',
      'redirect',
      'vercel',
      '/notes/',
      '/projects/',
    ]);

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const relative = file.slice(srcRoot.length + 1);
      const rssImport = /from\s+['"][^'"]*rss[^'"]*['"]/;
      expect(rssImport.test(source), `${relative} must not import rss`).toBe(false);
    }
  });

  it('keeps generic storage modules free of destination adapters', () => {
    const files = sourceFiles(join(import.meta.dirname, 'storage'));
    assertNoneMatch(files, [
      'adapters/webmention',
      'adapters/syndication',
      'adapters/presentation',
      'adapters/feeds',
      'adapters/routing',
      'bsky.social',
      'app.bsky.feed.post',
      'webmention.io',
    ]);
  });
});
