import { describe, expect, it } from 'vitest';

import { doodleVariantForHour } from './home-doodle-variant.js';

describe('doodleVariantForHour', () => {
  it('treats 05:59 as night and 06:00 as day', () => {
    expect(doodleVariantForHour(5)).toBe('night');
    expect(doodleVariantForHour(6)).toBe('day');
  });

  it('treats 18:59 as day and 19:00 as night', () => {
    expect(doodleVariantForHour(18)).toBe('day');
    expect(doodleVariantForHour(19)).toBe('night');
  });

  it('keeps midnight and noon on the expected sides', () => {
    expect(doodleVariantForHour(0)).toBe('night');
    expect(doodleVariantForHour(12)).toBe('day');
  });
});
