import type { Item, Property, Rule } from '../types';

export type Difficulty = 'makkelijk' | 'gemiddeld' | 'moeilijk';

export function evaluate(rule: Rule, item: Item): boolean {
  switch (rule.t) {
    case 'prop':
      return item.props.includes(rule.id);
    case 'not':
      return !evaluate(rule.r, item);
    case 'and':
      return evaluate(rule.a, item) && evaluate(rule.b, item);
  }
}

export function describe(rule: Rule, properties: Property[]): string {
  switch (rule.t) {
    case 'prop': {
      const p = properties.find((x) => x.id === rule.id);
      if (!p) throw new Error(`Onbekende eigenschap: ${rule.id}`);
      return p.label;
    }
    case 'not': {
      if (rule.r.t === 'prop') {
        const id = rule.r.id;
        const p = properties.find((x) => x.id === id);
        if (!p) throw new Error(`Onbekende eigenschap: ${id}`);
        return p.negLabel;
      }
      return `niet (${describe(rule.r, properties)})`;
    }
    case 'and':
      return `${describe(rule.a, properties)} en ${describe(rule.b, properties)}`;
  }
}

export function ruleKey(rule: Rule): string {
  switch (rule.t) {
    case 'prop':
      return rule.id;
    case 'not':
      return `!${ruleKey(rule.r)}`;
    case 'and':
      return `(${[ruleKey(rule.a), ruleKey(rule.b)].sort().join('&')})`;
  }
}

export function matchIds(rule: Rule, items: Item[]): string[] {
  return items.filter((i) => evaluate(rule, i)).map((i) => i.id);
}

export function literalCount(rule: Rule): number {
  switch (rule.t) {
    case 'prop':
      return 1;
    case 'not':
      return literalCount(rule.r);
    case 'and':
      return literalCount(rule.a) + literalCount(rule.b);
  }
}

function notCount(rule: Rule): number {
  switch (rule.t) {
    case 'prop':
      return 0;
    case 'not':
      return 1 + notCount(rule.r);
    case 'and':
      return notCount(rule.a) + notCount(rule.b);
  }
}

export function difficultyOf(rule: Rule): Difficulty {
  const literals = literalCount(rule);
  const nots = notCount(rule);
  if (literals === 1) return nots === 0 ? 'makkelijk' : 'gemiddeld';
  if (literals === 2) return nots === 0 ? 'gemiddeld' : 'moeilijk';
  return 'moeilijk';
}
