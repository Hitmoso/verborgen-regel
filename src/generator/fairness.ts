import { MIN_SIDE } from '../config';
import { literalCount, matchIds, ruleKey } from '../rules/rule';
import type { Item, Property, Rule } from '../types';

export type Ctx = { items: Item[]; properties: Property[]; overrides: Record<string, Rule> };
export type Problem = 'unknown-property' | 'too-few-matching' | 'too-few-non-matching' | 'ambiguous';

export function enumerateCandidates(properties: Property[]): Rule[] {
  const lits: Rule[] = [];
  const out: Rule[] = [];
  for (const p of properties) {
    out.push({ t: 'prop', id: p.id }, { t: 'not', r: { t: 'prop', id: p.id } });
  }
  for (let i = 0; i < properties.length; i++) {
    for (let j = i + 1; j < properties.length; j++) {
      for (const na of [false, true]) {
        for (const nb of [false, true]) {
          const a: Rule = { t: 'prop', id: properties[i].id };
          const b: Rule = { t: 'prop', id: properties[j].id };
          out.push({ t: 'and', a: na ? { t: 'not', r: a } : a, b: nb ? { t: 'not', r: b } : b });
        }
      }
    }
  }
  void lits;
  const keyed = out.map((r) => [ruleKey(r), r] as const);
  keyed.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return keyed.map((k) => k[1]);
}

type Entry = { rule: Rule; key: string; lits: number; sig: string };
type Table = { entries: Entry[]; groups: Map<string, Entry[]> };

const tables = new WeakMap<Item[], WeakMap<Property[], Table>>();

function signature(rule: Rule, items: Item[]): string {
  return matchIds(rule, items).join(',');
}

function tableFor(ctx: Pick<Ctx, 'items' | 'properties'>): Table {
  let byProps = tables.get(ctx.items);
  if (!byProps) {
    byProps = new WeakMap();
    tables.set(ctx.items, byProps);
  }
  let t = byProps.get(ctx.properties);
  if (!t) {
    const entries = enumerateCandidates(ctx.properties).map((rule) => ({
      rule,
      key: ruleKey(rule),
      lits: literalCount(rule),
      sig: signature(rule, ctx.items),
    }));
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const g = groups.get(e.sig);
      if (g) g.push(e);
      else groups.set(e.sig, [e]);
    }
    t = { entries, groups };
    byProps.set(ctx.properties, t);
  }
  return t;
}

function propIds(rule: Rule, acc: string[] = []): string[] {
  if (rule.t === 'prop') acc.push(rule.id);
  else if (rule.t === 'not') propIds(rule.r, acc);
  else {
    propIds(rule.a, acc);
    propIds(rule.b, acc);
  }
  return acc;
}

function check(rule: Rule, ctx: Pick<Ctx, 'items' | 'properties'>, t: Table, sig: string, count: number): Problem[] {
  const problems: Problem[] = [];
  const known = new Set(ctx.properties.map((p) => p.id));
  if (propIds(rule).some((id) => !known.has(id))) return ['unknown-property'];
  if (count < MIN_SIDE) problems.push('too-few-matching');
  if (ctx.items.length - count < MIN_SIDE) problems.push('too-few-non-matching');
  const key = ruleKey(rule);
  const lits = literalCount(rule);
  if ((t.groups.get(sig) ?? []).some((e) => e.key !== key && e.lits <= lits)) problems.push('ambiguous');
  return problems;
}

export function validateRule(rule: Rule, ctx: Pick<Ctx, 'items' | 'properties'>): Problem[] {
  const t = tableFor(ctx);
  const known = new Set(ctx.properties.map((p) => p.id));
  if (propIds(rule).some((id) => !known.has(id))) return ['unknown-property'];
  const ids = matchIds(rule, ctx.items);
  return check(rule, ctx, t, ids.join(','), ids.length);
}

export function fairCandidates(ctx: Pick<Ctx, 'items' | 'properties'>): Rule[] {
  const t = tableFor(ctx);
  return t.entries
    .filter((e) => {
      const count = e.sig === '' ? 0 : e.sig.split(',').length;
      return check(e.rule, ctx, t, e.sig, count).length === 0;
    })
    .map((e) => e.rule);
}

