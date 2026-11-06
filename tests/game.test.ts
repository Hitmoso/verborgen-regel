import { describe, it, expect } from 'vitest';
import { newGame, runTest, startExam, setExamAnswer, submitExam, testsLeft } from '../src/game/game';
import { examGuess } from '../src/game/guess';
import type { GuessMethod } from '../src/game/guess';
import { getPuzzle } from '../src/generator/generator';
import { evaluate } from '../src/rules/rule';
import { items } from '../src/data';
import { EPOCH, TEST_BUDGET, EXAMPLES_PER_SIDE, EXAM_SIZE } from '../src/config';

const puzzle = getPuzzle(EPOCH);
const byId = new Map(items.map((i) => [i.id, i]));
const yes = (id: string) => evaluate(puzzle.rule, byId.get(id)!);

function fresh() {
  return newGame(puzzle, items);
}
function untested(state: ReturnType<typeof fresh>, want: boolean) {
  const taken = new Set([...state.exampleYes, ...state.exampleNo]);
  return items.filter((i) => !taken.has(i.id) && evaluate(puzzle.rule, i) === want).map((i) => i.id);
}
function spend(want: boolean) {
  let s = fresh();
  for (const id of untested(s, want).slice(0, TEST_BUDGET)) s = runTest(s, puzzle, items, id);
  return s;
}

describe('newGame', () => {
  it('has examples per side, correct sides, deterministic, phase testing', () => {
    const g = fresh();
    expect(g.exampleYes).toHaveLength(EXAMPLES_PER_SIDE);
    expect(g.exampleNo).toHaveLength(EXAMPLES_PER_SIDE);
    expect(g.exampleYes.every(yes)).toBe(true);
    expect(g.exampleNo.every((id) => !yes(id))).toBe(true);
    expect(g).toEqual(fresh());
    expect(g.phase).toBe('testing');
    expect(g.dateKey).toBe(puzzle.dateKey);
    expect(testsLeft(g)).toBe(TEST_BUDGET);
  });
});

describe('runTest', () => {
  it('adds a test with the right result', () => {
    const g = fresh();
    const id = untested(g, true)[0];
    const g2 = runTest(g, puzzle, items, id);
    expect(g2.tests).toEqual([{ itemId: id, result: true }]);
    expect(testsLeft(g2)).toBe(TEST_BUDGET - 1);
    expect(g.tests).toHaveLength(0);
  });
  it('ignores double tap, example, unknown id', () => {
    const g = fresh();
    const id = untested(g, false)[0];
    const g2 = runTest(g, puzzle, items, id);
    expect(runTest(g2, puzzle, items, id)).toBe(g2);
    expect(runTest(g, puzzle, items, g.exampleYes[0])).toBe(g);
    expect(runTest(g, puzzle, items, 'bestaat-niet')).toBe(g);
  });
  it('ignores the 11th test', () => {
    const g = spend(true);
    expect(g.tests).toHaveLength(TEST_BUDGET);
    const extra = untested(g, false)[0];
    expect(runTest(g, puzzle, items, extra)).toBe(g);
  });
  it('ignores tests outside phase testing', () => {
    const e = startExam(fresh(), puzzle, items);
    expect(runTest(e, puzzle, items, untested(e, true)[0])).toBe(e);
  });
});

describe('startExam', () => {
  it('gives 8 ids, 4/4, no overlap, deterministic', () => {
    let g = fresh();
    for (const id of [...untested(g, true).slice(0, 3), ...untested(g, false).slice(0, 3)]) {
      g = runTest(g, puzzle, items, id);
    }
    const e = startExam(g, puzzle, items);
    expect(e.phase).toBe('exam');
    expect(e.examItemIds).toHaveLength(EXAM_SIZE);
    expect(new Set(e.examItemIds).size).toBe(EXAM_SIZE);
    expect(e.examItemIds.filter(yes)).toHaveLength(EXAM_SIZE / 2);
    const seen = new Set([...g.exampleYes, ...g.exampleNo, ...g.tests.map((t) => t.itemId)]);
    expect(e.examItemIds.some((id) => seen.has(id))).toBe(false);
    expect(startExam(g, puzzle, items)).toEqual(e);
  });
  it('worst case: 4/4 after 10 matching tests or 10 non-matching tests', () => {
    for (const want of [true, false]) {
      const e = startExam(spend(want), puzzle, items);
      expect(e.examItemIds).toHaveLength(EXAM_SIZE);
      expect(e.examItemIds.filter(yes)).toHaveLength(EXAM_SIZE / 2);
    }
  });
  it('outside testing returns same reference', () => {
    const e = startExam(fresh(), puzzle, items);
    expect(startExam(e, puzzle, items)).toBe(e);
  });
  it('uses a supplied GuessMethod', () => {
    const stub: GuessMethod = {
      id: 'stub',
      prepare: () => ({ itemIds: ['a', 'b'] }),
      judge: () => ({ correct: 1, total: 2, perfect: false }),
    };
    const e = startExam(fresh(), puzzle, items, stub);
    expect(e.examItemIds).toEqual(['a', 'b']);
    const a = setExamAnswer(setExamAnswer(e, 'a', true), 'b', true);
    const d = submitExam(a, puzzle, items, stub);
    expect(d.outcome).toMatchObject({ correct: 1, total: 2, perfect: false });
  });
});

describe('exam answers and submit', () => {
  it('perfect answers finish the game', () => {
    let e = startExam(spend(true), puzzle, items);
    for (const id of e.examItemIds) e = setExamAnswer(e, id, yes(id));
    const d = submitExam(e, puzzle, items);
    expect(d.phase).toBe('done');
    expect(d.outcome?.perfect).toBe(true);
    expect(d.outcome?.correct).toBe(EXAM_SIZE);
    expect(d.outcome?.testsLeft).toBe(0);
    expect(d.outcome?.score).toBe(80);
    expect(submitExam(d, puzzle, items)).toBe(d);
  });
  it('missing answers return the same reference', () => {
    let e = startExam(fresh(), puzzle, items);
    e = setExamAnswer(e, e.examItemIds[0], true);
    expect(submitExam(e, puzzle, items)).toBe(e);
  });
  it('setExamAnswer ignores wrong phase and foreign ids', () => {
    const g = fresh();
    expect(setExamAnswer(g, g.exampleYes[0], true)).toBe(g);
    const e = startExam(g, puzzle, items);
    expect(setExamAnswer(e, 'bestaat-niet', true)).toBe(e);
  });
  it('wrong answers are counted', () => {
    let e = startExam(fresh(), puzzle, items);
    for (const id of e.examItemIds) e = setExamAnswer(e, id, !yes(id));
    const d = submitExam(e, puzzle, items);
    expect(d.outcome).toMatchObject({ correct: 0, perfect: false, score: 0 });
  });
  it('state is JSON round-trippable', () => {
    const e = startExam(fresh(), puzzle, items);
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
    expect(examGuess.id).toBe('exam');
  });
});
