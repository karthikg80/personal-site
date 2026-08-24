import { describe, expect, it } from 'vitest';

import { projectPath } from './projects.js';

describe('projectPath', () => {
  it('builds the first-party project detail path from slug', () => {
    expect(projectPath('neighborbook')).toBe('/projects/neighborbook/');
    expect(projectPath('homebase')).toBe('/projects/homebase/');
  });
});
