import { describe, it, expect } from 'vitest';
import { enumerateCandidates, validateRule } from '../src/generator/fairness';
import type { Item, Property, Rule } from '../src/types';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
function fixture(extra: Record<string, number[]> = {}) {
  const sets: Record<string, number[]> = {
    a: range(0, 29),
    b: range(10, 44),
    c: range(0, 4),
    e: range(0, 39),
    ...extra,
  };
  const properties: Property[] = Object.keys(sets).map((id) => ({ id, label: id, negLabel: `niet ${id}` }));
  const items: Item[] = range(0, 59).map((n) => ({
    id: `i${n}`,
    name: `i${n}`,
    emoji: 'x',
    props: Object.keys(sets).filter((id) => sets[id].includes(n)),
  }));
  return { items, properties };
}
const p = (id: string): Rule => ({ t: 'prop', id });
const not = (r: Rule): Rule => ({ t: 'not', r });
const and = (a: Rule, b: Rule): Rule => ({ t: 'and', a, b });

describe('validateRule', () => {
  const ctx = fixture();
  it('accepts fair rules', () => {
    expect(validateRule(p('b'), ctx)).toEqual([]);
    expect(validateRule(not(p('b')), ctx)).toEqual([]);
    expect(validateRule(and(p('a'), p('b')), ctx)).toEqual([]);
    expect(validateRule(p('a'), ctx)).toEqual([]);
  });
  it('flags too few sides', () => {
    expect(validateRule(p('c'), ctx)).toContain('too-few-matching');
    expect(validateRule(not(p('c')), ctx)).toContain('too-few-non-matching');
  });
  it('flags unknown property', () => {
    expect(validateRule(p('zzz'), ctx)).toContain('unknown-property');
  });
  it('flags ambiguous rules', () => {
    expect(validateRule(and(p('a'), p('e')), ctx)).toContain('ambiguous');
  });
  it('flags identical properties as ambiguous', () => {
    const c2 = fixture({ d: range(0, 29) });
    expect(validateRule(p('a'), c2)).toContain('ambiguous');
    expect(validateRule(p('d'), c2)).toContain('ambiguous');
  });
});

describe('enumerateCandidates', () => {
  it('counts 18 for 3 properties without and(x,x)', () => {
    const props = ['x', 'y', 'z'].map((id) => ({ id, label: id, negLabel: id }));
    const c = enumerateCandidates(props);
    expect(c.length).toBe(18);
    expect(c.some((r) => r.t === 'and' && JSON.stringify(r.a).includes('"x"') && JSON.stringify(r.b).includes('"x"') && r.a.t === r.b.t && JSON.stringify(r.a) === JSON.stringify(r.b))).toBe(false);
  });
});
