import { describe, expect, it } from 'vitest';

import { hostLabel } from './host-label.js';

describe('hostLabel', () => {
  it('strips www from a hostname', () => {
    expect(hostLabel('https://www.example.com/path')).toBe('example.com');
  });

  it('returns the original value when the URL cannot be parsed', () => {
    expect(hostLabel('not a url')).toBe('not a url');
  });
});
