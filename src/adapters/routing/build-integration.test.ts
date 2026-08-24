import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('slug redirect build integration', () => {
  it('wires redirect generation before astro build', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8'));
    expect(pkg.scripts['generate:redirects']).toContain('generate-slug-redirects');
    expect(pkg.scripts.build).toMatch(/generate:redirects.*astro build/);
  });

  it('astro.config imports the generated redirect map', () => {
    const config = readFileSync(join(import.meta.dirname, '../../../astro.config.mjs'), 'utf8');
    expect(config).toContain("from './src/generated/slug-redirects.mjs'");
    expect(config).toContain('redirects: slugRedirects');
  });

  it('committed generated module is a valid empty map today', () => {
    const generated = readFileSync(
      join(import.meta.dirname, '../../../src/generated/slug-redirects.mjs'),
      'utf8'
    );
    expect(generated).toContain('export const slugRedirects = {};');
  });
});
