import { describe, it, expect } from 'vitest';
import { dateLabel } from '../src/ui/text';

describe('dateLabel', () => {
  it('formats a date key in Dutch without day shifts', () => {
    expect(dateLabel('2026-11-07')).toBe('7 november 2026');
    expect(dateLabel('2026-12-31')).toBe('31 december 2026');
    expect(dateLabel('2027-01-01')).toBe('1 januari 2027');
  });
});