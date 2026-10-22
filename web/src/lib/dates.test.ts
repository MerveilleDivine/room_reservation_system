import { describe, expect, it } from 'vitest';
import { toLocalInput, toUtc } from './dates';

describe('browser-local to UTC conversion', () => {
  it('round-trips local date and minute without dropping timezone conversion', () => {
    const date = new Date(2026, 9, 25, 13, 45);
    const input = toLocalInput(date);
    expect(input).toBe('2026-10-25T13:45');
    expect(toUtc(input)).toBe(date.toISOString());
  });

  it('pads single digit date and time fields', () => {
    expect(toLocalInput(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04');
  });
});
