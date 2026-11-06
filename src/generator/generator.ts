import { EPOCH, RECENT_DAYS } from '../config';
import { items, overrides, properties } from '../data';
import { addDays, dayIndex, normalizeDateKey, puzzleNumber } from '../lib/date';
import { hashString, mulberry32 } from '../lib/rng';
import { ruleKey } from '../rules/rule';
import type { Puzzle, Rule } from '../types';
import { fairCandidates, validateRule, type Ctx } from './fairness';

type Seq = { fair: Rule[]; days: { rule: Rule; isOverride: boolean }[]; keys: string[] };

const seqs = new WeakMap<Ctx, Seq>();
const defaultCtx: Ctx = { items, properties, overrides };

function seqFor(ctx: Ctx): Seq {
  let s = seqs.get(ctx);
  if (!s) {
    s = { fair: fairCandidates(ctx), days: [], keys: [] };
    seqs.set(ctx, s);
  }
  return s;
}

function extend(ctx: Ctx, s: Seq, upTo: number): void {
  while (s.days.length <= upTo) {
    const i = s.days.length;
    const dk = addDays(EPOCH, i);
    let entry: { rule: Rule; isOverride: boolean } | undefined;
    const ov = ctx.overrides[dk];
    if (ov) {
      const problems = validateRule(ov, ctx);
      if (problems.length === 0) entry = { rule: ov, isOverride: true };
      else console.warn(`Override voor ${dk} is niet geldig (${problems.join(', ')}); er wordt gegenereerd.`);
    }
    if (!entry) {
      const recent = new Set(s.keys.slice(Math.max(0, i - RECENT_DAYS), i));
      let pool = s.fair.filter((r) => !recent.has(ruleKey(r)));
      if (pool.length === 0) pool = s.fair;
      const rng = mulberry32(hashString(dk));
      entry = { rule: pool[Math.floor(rng() * pool.length)], isOverride: false };
    }
    s.days.push(entry);
    s.keys.push(ruleKey(entry.rule));
  }
}

export function getPuzzle(dateKey: string, ctx: Ctx = defaultCtx): Puzzle {
  const dk = normalizeDateKey(dateKey);
  const s = seqFor(ctx);
  const idx = dayIndex(dk);
  extend(ctx, s, idx);
  const d = s.days[idx];
  return { number: puzzleNumber(dk), dateKey: dk, rule: d.rule, isOverride: d.isOverride };
}
