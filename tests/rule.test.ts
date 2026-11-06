import { describe as suite, it, expect } from 'vitest';
import type { Item, Property, Rule } from '../src/types';
import { evaluate, describe, ruleKey, matchIds, literalCount, difficultyOf } from '../src/rules/rule';

const properties: Property[] = [
  { id: 'zwemmen', label: 'kan zwemmen', negLabel: 'kan niet zwemmen' },
  { id: 'vliegen', label: 'kan vliegen', negLabel: 'kan niet vliegen' },
];
const items: Item[] = [
  { id: 'eend', name: 'Eend', emoji: 'E', props: ['zwemmen', 'vliegen'] },
  { id: 'vis', name: 'Vis', emoji: 'V', props: ['zwemmen'] },
  { id: 'hond', name: 'Hond', emoji: 'H', props: [] },
];
const p = (id: string): Rule => ({ t: 'prop', id });
const not = (r: Rule): Rule => ({ t: 'not', r });
const and = (a: Rule, b: Rule): Rule => ({ t: 'and', a, b });

suite('evaluate', () => {
  it('prop', () => {
    expect(evaluate(p('vliegen'), items[0])).toBe(true);
    expect(evaluate(p('vliegen'), items[1])).toBe(false);
    expect(evaluate(p('onbekend'), items[0])).toBe(false);
  });
  it('not', () => {
    expect(evaluate(not(p('vliegen')), items[1])).toBe(true);
    expect(evaluate(not(p('vliegen')), items[0])).toBe(false);
  });
  it('and', () => {
    expect(evaluate(and(p('zwemmen'), p('vliegen')), items[0])).toBe(true);
    expect(evaluate(and(p('zwemmen'), p('vliegen')), items[1])).toBe(false);
    expect(evaluate(and(p('zwemmen'), not(p('vliegen'))), items[1])).toBe(true);
    expect(evaluate(and(p('zwemmen'), not(p('vliegen'))), items[0])).toBe(false);
    expect(evaluate(and(p('zwemmen'), not(p('vliegen'))), items[2])).toBe(false);
  });
});

suite('describe', () => {
  it('describes literals and conjunctions', () => {
    expect(describe(p('zwemmen'), properties)).toBe('kan zwemmen');
    expect(describe(not(p('zwemmen')), properties)).toBe('kan niet zwemmen');
    expect(describe(and(p('zwemmen'), not(p('vliegen'))), properties)).toBe('kan zwemmen en kan niet vliegen');
  });
  it('wraps a not of a non-prop', () => {
    expect(describe(not(and(p('zwemmen'), p('vliegen'))), properties)).toBe('niet (kan zwemmen en kan vliegen)');
  });
  it('throws on unknown id', () => {
    expect(() => describe(p('onbekend'), properties)).toThrow(Error);
    expect(() => describe(not(p('onbekend')), properties)).toThrow(Error);
  });
});

suite('ruleKey', () => {
  it('is order independent for and', () => {
    expect(ruleKey(and(p('zwemmen'), p('vliegen')))).toBe(ruleKey(and(p('vliegen'), p('zwemmen'))));
  });
  it('distinguishes not', () => {
    expect(ruleKey(not(p('zwemmen')))).not.toBe(ruleKey(p('zwemmen')));
  });
});

suite('matchIds / literalCount', () => {
  it('returns matching ids in item order', () => {
    expect(matchIds(p('zwemmen'), items)).toEqual(['eend', 'vis']);
    expect(matchIds(not(p('zwemmen')), items)).toEqual(['hond']);
    expect(matchIds(and(p('zwemmen'), p('vliegen')), items)).toEqual(['eend']);
  });
  it('counts prop leaves', () => {
    expect(literalCount(p('zwemmen'))).toBe(1);
    expect(literalCount(not(p('zwemmen')))).toBe(1);
    expect(literalCount(and(p('zwemmen'), not(p('vliegen'))))).toBe(2);
  });
});

suite('difficultyOf', () => {
  it('classifies the four cases', () => {
    expect(difficultyOf(p('zwemmen'))).toBe('makkelijk');
    expect(difficultyOf(not(p('zwemmen')))).toBe('gemiddeld');
    expect(difficultyOf(and(p('zwemmen'), p('vliegen')))).toBe('gemiddeld');
    expect(difficultyOf(and(p('zwemmen'), not(p('vliegen'))))).toBe('moeilijk');
  });
  it('treats other shapes as moeilijk', () => {
    expect(difficultyOf(and(p('a'), and(p('b'), p('c'))))).toBe('moeilijk');
  });
});
