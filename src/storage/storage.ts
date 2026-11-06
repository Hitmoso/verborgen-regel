import { STORAGE_KEY } from '../config';
import { addDays } from '../lib/date';
import type { GameState } from '../game/game';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const GAME_KEY = STORAGE_KEY + ':game';
const STREAK_KEY = STORAGE_KEY + ':streak';

/** Lazily resolve localStorage; null when missing or access throws. */
function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

function isOutcome(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.correct === 'number' &&
    typeof x.total === 'number' &&
    typeof x.perfect === 'boolean' &&
    typeof x.testsLeft === 'number' &&
    typeof x.score === 'number'
  );
}

export function isValidGameState(x: unknown): x is GameState {
  if (!isRecord(x)) return false;
  if (typeof x.dateKey !== 'string') return false;
  if (x.phase !== 'testing' && x.phase !== 'exam' && x.phase !== 'done') return false;
  if (!isStringArray(x.exampleYes) || !isStringArray(x.exampleNo) || !isStringArray(x.examItemIds)) {
    return false;
  }
  if (
    !Array.isArray(x.tests) ||
    !x.tests.every((t) => isRecord(t) && typeof t.itemId === 'string' && typeof t.result === 'boolean')
  ) {
    return false;
  }
  if (!isRecord(x.examAnswers) || !Object.values(x.examAnswers).every((v) => typeof v === 'boolean')) {
    return false;
  }
  if (x.outcome !== undefined && !isOutcome(x.outcome)) return false;
  if (x.phase === 'done' && x.outcome === undefined) return false;
  return true;
}

export function saveGame(state: GameState, store?: Store): void {
  try {
    const s = store ?? defaultStore();
    if (!s) return;
    s.setItem(GAME_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable or full: ignore
  }
}

export function loadGame(dateKey: string, store?: Store): GameState | null {
  try {
    const s = store ?? defaultStore();
    if (!s) return null;
    const raw = s.getItem(GAME_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidGameState(parsed) || parsed.dateKey !== dateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type StreakInfo = { lastCompleted: string | null; streak: number };

const EMPTY_STREAK = (): StreakInfo => ({ lastCompleted: null, streak: 0 });

export function loadStreak(store?: Store): StreakInfo {
  try {
    const s = store ?? defaultStore();
    if (!s) return EMPTY_STREAK();
    const raw = s.getItem(STREAK_KEY);
    if (raw === null) return EMPTY_STREAK();
    const p: unknown = JSON.parse(raw);
    if (
      isRecord(p) &&
      (p.lastCompleted === null || typeof p.lastCompleted === 'string') &&
      typeof p.streak === 'number' &&
      Number.isFinite(p.streak) &&
      p.streak >= 0
    ) {
      return { lastCompleted: p.lastCompleted, streak: p.streak };
    }
    return EMPTY_STREAK();
  } catch {
    return EMPTY_STREAK();
  }
}

export function recordCompletion(dateKey: string, store?: Store): StreakInfo {
  const prev = loadStreak(store);
  let next: StreakInfo;
  if (prev.lastCompleted === dateKey) {
    next = prev;
  } else if (prev.lastCompleted !== null && prev.lastCompleted === addDays(dateKey, -1)) {
    next = { lastCompleted: dateKey, streak: prev.streak + 1 };
  } else {
    next = { lastCompleted: dateKey, streak: 1 };
  }
  try {
    const s = store ?? defaultStore();
    if (s) s.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function currentStreak(info: StreakInfo, todayKey: string): number {
  if (info.lastCompleted === null) return 0;
  return info.lastCompleted === todayKey || info.lastCompleted === addDays(todayKey, -1)
    ? info.streak
    : 0;
}
