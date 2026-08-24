import { describe, expect, it } from 'vitest';

import { projectPath } from './projects.js';

/**
 * Pure sitemap path composition mirror of src/pages/sitemap.xml.ts.
 * Keeps routing/sitemap expectations testable without Astro runtime.
 */
function sitemapPaths(input: {
  notePaths: string[];
  projectSlugs: string[];
}): string[] {
  const staticPaths = [
    '/',
    '/about',
    '/now',
    '/notes',
    '/projects',
    '/resume',
    '/contact',
    '/colophon',
    '/wander',
  ];
  return [
    ...staticPaths,
    ...input.notePaths,
    ...input.projectSlugs.map(projectPath),
  ];
}

describe('sitemap project detail inclusion', () => {
  it('includes each project detail path exactly once and keeps /projects', () => {
    const projectSlugs = [
      'homebase',
      'neighborbook',
      'pantry-mojo',
      'sai-parayan-tracker',
      'thea-kitchen',
    ];
    const paths = sitemapPaths({
      notePaths: ['/notes/first-note-probably/'],
      projectSlugs,
    });

    expect(paths.filter((path) => path === '/projects')).toHaveLength(1);
    for (const slug of projectSlugs) {
      expect(paths.filter((path) => path === `/projects/${slug}/`)).toHaveLength(1);
    }
    expect(paths).toContain('/notes/first-note-probably/');
  });
});
