import type { Item, Puzzle } from '../types';
import { evaluate } from '../rules/rule';
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { TEST_BUDGET, EXAMPLES_PER_SIDE } from '../config';
import { computeScore } from './score';
import { examGuess } from './guess';
import type { GuessMethod } from './guess';

export type GameState = {
  dateKey: string;
  phase: 'testing' | 'exam' | 'done';
  exampleYes: string[];
  exampleNo: string[];
  tests: { itemId: string; result: boolean }[];
  examItemIds: string[];
  examAnswers: Record<string, boolean>;
  outcome?: { correct: number; total: number; perfect: boolean; testsLeft: number; score: number };
};

export function newGame(puzzle: Puzzle, items: Item[]): GameState {
  const sorted = items.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rng = mulberry32(hashString(puzzle.dateKey + ':examples'));
  const yes = shuffle(sorted.filter((i) => evaluate(puzzle.rule, i)), rng);
  const no = shuffle(sorted.filter((i) => !evaluate(puzzle.rule, i)), rng);
  return {
    dateKey: puzzle.dateKey,
    phase: 'testing',
    exampleYes: yes.slice(0, EXAMPLES_PER_SIDE).map((i) => i.id),
    exampleNo: no.slice(0, EXAMPLES_PER_SIDE).map((i) => i.id),
    tests: [],
    examItemIds: [],
    examAnswers: {},
  };
}

export function testsLeft(state: GameState): number {
  return Math.max(0, TEST_BUDGET - state.tests.length);
}

export function runTest(state: GameState, puzzle: Puzzle, items: Item[], itemId: string): GameState {
  if (state.phase !== 'testing' || testsLeft(state) <= 0) return state;
  if (state.tests.some((t) => t.itemId === itemId)) return state;
  if (state.exampleYes.includes(itemId) || state.exampleNo.includes(itemId)) return state;
  const item = items.find((i) => i.id === itemId);
  if (!item) return state;
  return { ...state, tests: [...state.tests, { itemId, result: evaluate(puzzle.rule, item) }] };
}

export function startExam(
  state: GameState,
  puzzle: Puzzle,
  items: Item[],
  guess: GuessMethod = examGuess,
): GameState {
  if (state.phase !== 'testing') return state;
  const seenItemIds = [...state.exampleYes, ...state.exampleNo, ...state.tests.map((t) => t.itemId)];
  const prompt = guess.prepare({ puzzle, seenItemIds, items });
  return { ...state, phase: 'exam', examItemIds: prompt.itemIds, examAnswers: {} };
}

export function setExamAnswer(state: GameState, itemId: string, value: boolean): GameState {
  if (state.phase !== 'exam' || !state.examItemIds.includes(itemId)) return state;
  return { ...state, examAnswers: { ...state.examAnswers, [itemId]: value } };
}

export function submitExam(
  state: GameState,
  puzzle: Puzzle,
  items: Item[],
  guess: GuessMethod = examGuess,
): GameState {
  if (state.phase !== 'exam') return state;
  if (!state.examItemIds.every((id) => typeof state.examAnswers[id] === 'boolean')) return state;
  const judged = guess.judge({
    puzzle,
    prompt: { itemIds: state.examItemIds },
    answers: state.examAnswers,
    items,
  });
  const left = testsLeft(state);
  const score = computeScore({ correct: judged.correct, total: judged.total, testsLeft: left });
  return { ...state, phase: 'done', outcome: { ...judged, testsLeft: left, score } };
}
