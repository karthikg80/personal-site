import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { mapNote } from './map-note.js';

/**
 * Gate A / integration-ish check: mapped published notes match committed content.
 */
describe('content mapping against repository', () => {
  it('maps the legacy public note without changing identity fields', () => {
    const raw = readFileSync(
      join(import.meta.dirname, '../../content/notes/first-note-probably.md'),
      'utf8'
    );
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) throw new Error('missing frontmatter');
    const data = parseYaml(match[1]) as {
      id: string;
      slug: string;
      previousSlugs: string[];
      title: string;
      summary?: string;
      presentation: 'note' | 'scrap';
      tags: string[];
      draft: boolean;
      privacyReviewed: boolean;
      syndication: string[];
      legacyRssGuid?: string;
      date: Date;
    };

    const note = mapNote({
      ...data,
      date: new Date(data.date),
    });

    expect(note.id).toBe('01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5');
    expect(note.slug).toBe('first-note-probably');
    expect(note.publication).toBe('public');
    expect(note.legacyRssGuid).toBe('https://karthikg.in/notes/first-note-probably/');
    expect(note.syndication[0]?.url).toBe(
      'https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a'
    );
  });

  it('keeps note and project file counts stable', () => {
    const notes = readdirSync(join(import.meta.dirname, '../../content/notes')).filter((f) =>
      f.endsWith('.md')
    );
    const projects = readdirSync(join(import.meta.dirname, '../../content/projects')).filter((f) =>
      f.endsWith('.md')
    );
    expect(notes.length).toBe(3);
    expect(projects.length).toBe(5);
  });
});
