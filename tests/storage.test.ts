import { describe, it, expect } from 'vitest';
import { STORAGE_KEY } from '../src/config';
import type { GameState } from '../src/game/game';
import {
  isValidGameState,
  saveGame,
  loadGame,
  loadStreak,
  recordCompletion,
  currentStreak,
} from '../src/storage/storage';

function fakeStore() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error('boom');
  },
  setItem: (): void => {
    throw new Error('boom');
  },
};

const GAME_KEY = STORAGE_KEY + ':game';
const STREAK_KEY = STORAGE_KEY + ':streak';

function examState(): GameState {
  return {
    dateKey: '2026-11-10',
    phase: 'exam',
    exampleYes: ['a', 'b', 'c'],
    exampleNo: ['d', 'e', 'f'],
    tests: [
      { itemId: 'x', result: true },
      { itemId: 'y', result: false },
    ],
    examItemIds: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8'],
    examAnswers: { i1: true, i2: false, i3: true },
  };
}

function doneState(): GameState {
  return {
    ...examState(),
    phase: 'done',
    outcome: { correct: 7, total: 8, perfect: false, testsLeft: 3, score: 70 },
  };
}

describe('game persistence', () => {
  it('round-trips a state', () => {
    const s = fakeStore();
    const g = doneState();
    saveGame(g, s);
    expect(loadGame(g.dateKey, s)).toEqual(g);
  });

  it('restores a mid-exam state identically', () => {
    const s = fakeStore();
    const g = examState();
    saveGame(g, s);
    const back = loadGame(g.dateKey, s)!;
    expect(back.phase).toBe('exam');
    expect(back.examItemIds).toEqual(g.examItemIds);
    expect(back.examAnswers).toEqual(g.examAnswers);
    expect(back).toEqual(g);
  });

  it('ignores a state from another day', () => {
    const s = fakeStore();
    saveGame(examState(), s);
    expect(loadGame('2026-11-11', s)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(loadGame('2026-11-10', fakeStore())).toBeNull();
  });

  it('returns null for broken or invalid data', () => {
    const bad = [
      'not json{',
      '{}',
      'null',
      '[]',
      JSON.stringify({ ...examState(), phase: 'weird' }),
      JSON.stringify({ ...examState(), tests: 'nope' }),
      JSON.stringify({ ...examState(), tests: [{ itemId: 'x', result: 'yes' }] }),
      JSON.stringify({ ...examState(), examAnswers: [] }),
      JSON.stringify({ ...examState(), examAnswers: null }),
      JSON.stringify({ ...examState(), examAnswers: { a: 1 } }),
      JSON.stringify({ ...examState(), examItemIds: [1] }),
      JSON.stringify({ ...doneState(), outcome: undefined }),
      JSON.stringify({ ...examState(), phase: 'done' }),
      JSON.stringify({ ...doneState(), outcome: { correct: 1 } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, testsLeft: 11 } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, testsLeft: -1 } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, testsLeft: 2.5 } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, correct: 9 } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, score: -1 } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, perfect: 'yes' } }),
      JSON.stringify({ ...doneState(), outcome: { ...doneState().outcome, total: '8' } }),
      JSON.stringify({ ...examState(), examItemIds: [] }),
      JSON.stringify({ ...examState(), examItemIds: ['i1', 'i2'] }),
      JSON.stringify({ ...doneState(), examItemIds: ['i1'] }),
      JSON.stringify({
        ...examState(),
        tests: Array.from({ length: 11 }, (_, i) => ({ itemId: 't' + i, result: true })),
      }),
    ];
    for (const raw of bad) {
      const s = fakeStore();
      s.setItem(GAME_KEY, raw);
      expect(loadGame('2026-11-10', s), raw).toBeNull();
    }
  });

  it('does not crash on throwing storage', () => {
    expect(loadGame('2026-11-10', throwing)).toBeNull();
    expect(() => saveGame(examState(), throwing)).not.toThrow();
    expect(loadStreak(throwing)).toEqual({ lastCompleted: null, streak: 0 });
    expect(() => recordCompletion('2026-11-10', throwing)).not.toThrow();
  });

  it('does not crash without localStorage (node)', () => {
    expect(loadGame('2026-11-10')).toBeNull();
    expect(() => saveGame(examState())).not.toThrow();
    expect(loadStreak()).toEqual({ lastCompleted: null, streak: 0 });
  });
});

describe('isValidGameState', () => {
  it('accepts valid states and rejects junk', () => {
    expect(isValidGameState(examState())).toBe(true);
    expect(isValidGameState(doneState())).toBe(true);
    expect(isValidGameState({ ...examState(), phase: 'testing', examItemIds: [] })).toBe(true);
    expect(isValidGameState(null)).toBe(false);
    expect(isValidGameState('x')).toBe(false);
    expect(isValidGameState({})).toBe(false);
  });
});

describe('streak', () => {
  it('first completion is 1', () => {
    const s = fakeStore();
    expect(recordCompletion('2026-11-10', s)).toEqual({ lastCompleted: '2026-11-10', streak: 1 });
    expect(loadStreak(s)).toEqual({ lastCompleted: '2026-11-10', streak: 1 });
  });

  it('next day is 2', () => {
    const s = fakeStore();
    recordCompletion('2026-11-10', s);
    expect(recordCompletion('2026-11-11', s).streak).toBe(2);
  });

  it('same day twice stays 2', () => {
    const s = fakeStore();
    recordCompletion('2026-11-10', s);
    recordCompletion('2026-11-11', s);
    expect(recordCompletion('2026-11-11', s).streak).toBe(2);
  });

  it('skipped day resets to 1', () => {
    const s = fakeStore();
    recordCompletion('2026-11-10', s);
    expect(recordCompletion('2026-11-12', s).streak).toBe(1);
  });

  it('broken streak data gives default', () => {
    const s = fakeStore();
    s.setItem(STREAK_KEY, '{"lastCompleted":5,"streak":"x"}');
    expect(loadStreak(s)).toEqual({ lastCompleted: null, streak: 0 });
    s.setItem(STREAK_KEY, 'garbage');
    expect(loadStreak(s)).toEqual({ lastCompleted: null, streak: 0 });
  });

  it('currentStreak', () => {
    const info = { lastCompleted: '2026-11-10', streak: 4 };
    expect(currentStreak(info, '2026-11-10')).toBe(4);
    expect(currentStreak(info, '2026-11-11')).toBe(4);
    expect(currentStreak(info, '2026-11-12')).toBe(0);
    expect(currentStreak({ lastCompleted: null, streak: 0 }, '2026-11-12')).toBe(0);
  });
});
