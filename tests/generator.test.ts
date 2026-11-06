import { describe, it, expect, vi } from 'vitest';
import { fairCandidates, validateRule } from '../src/generator/fairness';
import { getPuzzle } from '../src/generator/generator';
import { items, properties } from '../src/data';
import { ruleKey } from '../src/rules/rule';
import { addDays } from '../src/lib/date';
import { EPOCH, RECENT_DAYS } from '../src/config';
import type { Rule } from '../src/types';

describe('generator', () => {
  it('has enough fair candidates', () => {
    expect(fairCandidates({ items, properties }).length).toBeGreaterThanOrEqual(100);
  });
  it('is deterministic and numbered', () => {
    expect(getPuzzle(EPOCH)).toEqual(getPuzzle(EPOCH));
    expect(getPuzzle(EPOCH).number).toBe(1);
    expect(getPuzzle(addDays(EPOCH, 4)).number).toBe(5);
  });
  it('1000 days: valid and no repeats within the recent window', () => {
    const keys: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const pz = getPuzzle(addDays(EPOCH, i));
      expect(validateRule(pz.rule, { items, properties })).toEqual([]);
      keys.push(ruleKey(pz.rule));
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = Math.max(0, i - RECENT_DAYS + 1); j < i; j++) expect(keys[j]).not.toBe(keys[i]);
    }
  });
  it('uses a valid override', () => {
    const rule: Rule = fairCandidates({ items, properties })[5];
    const dk = addDays(EPOCH, 3);
    const ctx = { items, properties, overrides: { [dk]: rule } };
    const pz = getPuzzle(dk, ctx);
    expect(pz.isOverride).toBe(true);
    expect(pz.rule).toEqual(rule);
  });
  it('falls back on an invalid override', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dk = addDays(EPOCH, 2);
    const ctx = { items, properties, overrides: { [dk]: { t: 'prop', id: 'nope' } as Rule } };
    const pz = getPuzzle(dk, ctx);
    expect(pz.isOverride).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('normalizes early dates', () => {
    expect(getPuzzle('2020-01-01')).toEqual(getPuzzle(EPOCH));
  });
});

