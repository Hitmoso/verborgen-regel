import { describe, it, expect } from 'vitest';
import { EPOCH } from '../src/config';
import {
  toDateKey,
  dayIndex,
  normalizeDateKey,
  puzzleNumber,
  msUntilNextPuzzle,
  addDays,
  isNewDay,
} from '../src/lib/date';

describe('toDateKey', () => {
  it('uses Amsterdam summer time', () => {
    expect(toDateKey(new Date(Date.UTC(2026, 6, 1, 22, 30)))).toBe('2026-07-02');
  });
  it('uses Amsterdam winter time', () => {
    expect(toDateKey(new Date(Date.UTC(2026, 0, 1, 22, 30)))).toBe('2026-01-01');
  });
});

describe('dayIndex', () => {
  it('counts days after the epoch', () => {
    expect(dayIndex('2026-11-10', '2026-11-07')).toBe(3);
  });
  it('can be negative', () => {
    expect(dayIndex('2026-11-01', '2026-11-07')).toBe(-6);
  });
});

describe('puzzleNumber / normalizeDateKey', () => {
  it('starts at 1 on the epoch', () => {
    expect(puzzleNumber(EPOCH)).toBe(1);
  });
  it('clamps dates before the epoch', () => {
    expect(puzzleNumber('2020-01-01')).toBe(1);
    expect(normalizeDateKey('2020-01-01')).toBe(EPOCH);
    expect(normalizeDateKey('2026-12-01')).toBe('2026-12-01');
  });
});

describe('msUntilNextPuzzle', () => {
  it('is 30 minutes at 23:30 Amsterdam time', () => {
    expect(msUntilNextPuzzle(new Date(Date.UTC(2026, 0, 1, 22, 30)))).toBe(30 * 60 * 1000);
  });
});

describe('addDays', () => {
  it('rolls over month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });
});

describe('isNewDay', () => {
  it('is false before the epoch (puzzle normalised to EPOCH)', () => {
    expect(isNewDay(EPOCH, new Date(Date.UTC(2026, 10, 6, 12)))).toBe(false);
  });
  it('is false on the same day', () => {
    expect(isNewDay('2026-11-10', new Date(Date.UTC(2026, 10, 10, 12)))).toBe(false);
  });
  it('is true after a real day change', () => {
    expect(isNewDay('2026-11-10', new Date(Date.UTC(2026, 10, 11, 12)))).toBe(true);
  });
});
