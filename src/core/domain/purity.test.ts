import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('domain package purity', () => {
  it('does not import Astro, adapters, or protocol modules', () => {
    const domainDir = join(import.meta.dirname);
    const files = readdirSync(domainDir).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts')
    );
    const forbidden = [
      'astro:',
      'from \'astro',
      'from "astro',
      'adapters/',
      'webmention',
      'bluesky',
      '../pages/',
      '../components/',
      '../layouts/',
      'generate-object-id',
      'redirect',
      'vercel',
      '/notes/',
      '/projects/',
    ];

    for (const file of files) {
      const source = readFileSync(join(domainDir, file), 'utf8');
      for (const pattern of forbidden) {
        expect(source.includes(pattern), `${file} must not contain ${pattern}`).toBe(false);
      }
    }
  });
});
