import { describe, it, expect } from 'vitest';
import { computeScore } from '../src/game/score';
import { buildShareText } from '../src/game/share';

describe('computeScore', () => {
  it('geeft 100 bij alles goed en 10 tests over', () => {
    expect(computeScore({ correct: 8, total: 8, testsLeft: 10 })).toBe(100);
  });

  it('geeft 80 bij alles goed en geen tests over', () => {
    expect(computeScore({ correct: 8, total: 8, testsLeft: 0 })).toBe(80);
  });

  it('telt fout beantwoorde items af en wordt niet negatief', () => {
    expect(computeScore({ correct: 4, total: 8, testsLeft: 5 })).toBe(10);
    expect(computeScore({ correct: 0, total: 8, testsLeft: 0 })).toBe(0);
  });
});

describe('buildShareText', () => {
  it('bouwt de tekst bij een perfecte score', () => {
    expect(
      buildShareText({ puzzleNumber: 42, testsUsed: 3, correct: 8, total: 8 }),
    ).toBe('Regel #42 🔍🔍🔍⬜⬜⬜⬜⬜⬜⬜ 8/8 ✅');
  });

  it('toont 0 en 10 gebruikte tests', () => {
    expect(buildShareText({ puzzleNumber: 1, testsUsed: 0, correct: 8, total: 8 })).toBe(
      'Regel #1 ' + '⬜'.repeat(10) + ' 8/8 ✅',
    );
    expect(buildShareText({ puzzleNumber: 1, testsUsed: 10, correct: 8, total: 8 })).toBe(
      'Regel #1 ' + '🔍'.repeat(10) + ' 8/8 ✅',
    );
  });

  it('klemt een ongeldig aantal tests zonder te crashen', () => {
    expect(() => buildShareText({ puzzleNumber: 1, testsUsed: -3, correct: 8, total: 8 })).not.toThrow();
    expect(buildShareText({ puzzleNumber: 1, testsUsed: -3, correct: 8, total: 8 })).toContain('⬜'.repeat(10));
    expect(buildShareText({ puzzleNumber: 1, testsUsed: 99, correct: 8, total: 8 })).toContain('🔍'.repeat(10));
    expect(buildShareText({ puzzleNumber: 1, testsUsed: 2.5, correct: 8, total: 8 })).not.toContain('NaN');
  });

  it('eindigt op ❌ als niet alles goed is', () => {
    expect(
      buildShareText({ puzzleNumber: 42, testsUsed: 3, correct: 6, total: 8 }),
    ).toMatch(/ 6\/8 ❌$/);
  });
});
