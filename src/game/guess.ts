import type { Item, Puzzle } from '../types';
import { evaluate } from '../rules/rule';
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { EXAM_SIZE } from '../config';

export type GuessPrompt = { itemIds: string[] };
export type GuessOutcome = { correct: number; total: number; perfect: boolean };

export interface GuessMethod {
  id: string;
  prepare(ctx: { puzzle: Puzzle; seenItemIds: string[]; items: Item[] }): GuessPrompt;
  judge(ctx: {
    puzzle: Puzzle;
    prompt: GuessPrompt;
    answers: Record<string, boolean>;
    items: Item[];
  }): GuessOutcome;
}

const byIdAsc = (a: Item, b: Item) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const examGuess: GuessMethod = {
  id: 'exam',
  prepare({ puzzle, seenItemIds, items }) {
    const seen = new Set(seenItemIds);
    const unseen = items.filter((i) => !seen.has(i.id)).sort(byIdAsc);
    const yes = unseen.filter((i) => evaluate(puzzle.rule, i));
    const no = unseen.filter((i) => !evaluate(puzzle.rule, i));
    const rng = mulberry32(hashString(puzzle.dateKey + ':exam'));
    const half = EXAM_SIZE / 2;
    const picked = [...shuffle(yes, rng).slice(0, half), ...shuffle(no, rng).slice(0, half)];
    return { itemIds: shuffle(picked, rng).map((i) => i.id) };
  },
  judge({ puzzle, prompt, answers, items }) {
    const byId = new Map(items.map((i) => [i.id, i]));
    let correct = 0;
    for (const id of prompt.itemIds) {
      const item = byId.get(id);
      if (item && answers[id] === evaluate(puzzle.rule, item)) correct++;
    }
    const total = prompt.itemIds.length;
    return { correct, total, perfect: correct === total };
  },
};
