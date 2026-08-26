import { describe, expect, it } from 'vitest';

import { isNoteStamp, stampLabel, NOTE_STAMPS } from './note-stamps.js';

describe('note stamps', () => {
  it('accepts the small editorial vocabulary', () => {
    expect(NOTE_STAMPS).toEqual(['first-go', 'still-thinking', 'revised', 'short-one']);
    expect(isNoteStamp('first-go')).toBe(true);
    expect(isNoteStamp('still-thinking')).toBe(true);
    expect(isNoteStamp('badge')).toBe(false);
  });

  it('maps stamps to lowercase ink labels', () => {
    expect(stampLabel('first-go')).toBe('first go');
    expect(stampLabel('still-thinking')).toBe('still thinking');
    expect(stampLabel('revised')).toBe('revised');
    expect(stampLabel('short-one')).toBe('short one');
  });
});
