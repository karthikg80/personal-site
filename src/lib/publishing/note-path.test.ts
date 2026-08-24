import { describe, expect, it } from 'vitest';

import { noteRepoPath } from './note-path.js';

describe('noteRepoPath', () => {
  it('builds a notes path from a valid slug', () => {
    expect(noteRepoPath('first-note-probably')).toBe('src/content/notes/first-note-probably.md');
  });

  it('rejects README', () => {
    expect(() => noteRepoPath('README')).toThrow(/reserved/i);
  });

  it('rejects traversal and extra segments', () => {
    expect(() => noteRepoPath('../projects/x')).toThrow();
    expect(() => noteRepoPath('a/b')).toThrow();
    expect(() => noteRepoPath('')).toThrow();
  });
});
