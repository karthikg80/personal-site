import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { mapProject } from './map-project.js';
import { projectPath } from '../../lib/projects.js';

const projectsDir = join(import.meta.dirname, '../../content/projects');

function loadProjectFiles() {
  return readdirSync(projectsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const raw = readFileSync(join(projectsDir, name), 'utf8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!match) throw new Error(`missing frontmatter in ${name}`);
      const data = parseYaml(match[1]) as Parameters<typeof mapProject>[0] & {
        date: Date | string;
      };
      return {
        name,
        project: mapProject({
          ...data,
          date: new Date(data.date),
          updated: data.updated ? new Date(data.updated) : undefined,
        }),
      };
    });
}

describe('canonical project inventory', () => {
  it('keeps five projects with stable slugs and first-party paths', () => {
    const files = loadProjectFiles();
    expect(files).toHaveLength(5);

    const slugs = files.map((file) => file.project.slug).sort();
    expect(slugs).toEqual([
      'homebase',
      'neighborbook',
      'pantry-mojo',
      'sai-parayan-tracker',
      'thea-kitchen',
    ]);

    for (const { project } of files) {
      expect(projectPath(project.slug)).toBe(`/projects/${project.slug}/`);
      expect(project.links.some((link) => link.kind === 'live')).toBe(true);
    }
  });

  it('preserves exact live URLs after links[] migration', () => {
    const bySlug = Object.fromEntries(
      loadProjectFiles().map(({ project }) => [project.slug, project])
    );

    expect(bySlug.neighborbook.links).toEqual([
      { kind: 'live', url: 'https://neighborbook.theafoundry.com' },
    ]);
    expect(bySlug.homebase.links).toEqual([
      { kind: 'live', url: 'https://homebase.theafoundry.com' },
    ]);
    expect(bySlug['pantry-mojo'].links).toEqual([
      { kind: 'live', url: 'https://pantrymojo.com' },
    ]);
    expect(bySlug['sai-parayan-tracker'].links).toEqual([
      { kind: 'live', url: 'https://sai-parayan.theafoundry.com' },
    ]);
    expect(bySlug['thea-kitchen'].links).toEqual([
      { kind: 'live', url: 'https://theakitchen.app' },
    ]);
  });
});
