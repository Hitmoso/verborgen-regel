import { describe, it, expect } from 'vitest';
import { properties, items, overrides } from '../src/data';

const CATS = ['dier', 'plant', 'voorwerp', 'plaats'] as const;

describe('data', () => {
  it('heeft precies 30 eigenschappen met unieke ids', () => {
    expect(properties.length).toBe(30);
    expect(new Set(properties.map((p) => p.id)).size).toBe(properties.length);
  });

  it('heeft minstens 150 items met unieke ids', () => {
    expect(items.length).toBeGreaterThanOrEqual(150);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('elke props-id bestaat', () => {
    const ids = new Set(properties.map((p) => p.id));
    for (const item of items) {
      for (const p of item.props) expect(ids.has(p), `${item.id}: ${p}`).toBe(true);
    }
  });

  it('elk item heeft precies één categorie', () => {
    for (const item of items) {
      const n = CATS.filter((c) => item.props.includes(c)).length;
      expect(n, item.id).toBe(1);
    }
  });

  it('dier of plant ⇔ levend', () => {
    for (const item of items) {
      const living = item.props.includes('dier') || item.props.includes('plant');
      expect(item.props.includes('levend'), item.id).toBe(living);
    }
  });

  it('zoogdier ⇒ dier', () => {
    for (const item of items) {
      if (item.props.includes('zoogdier')) expect(item.props.includes('dier'), item.id).toBe(true);
    }
  });

  it('heeft_vier_poten ⇒ geen plant en geen plaats', () => {
    for (const item of items) {
      if (item.props.includes('heeft_vier_poten')) {
        expect(item.props.includes('plant'), item.id).toBe(false);
        expect(item.props.includes('plaats'), item.id).toBe(false);
      }
    }
  });

  it('heeft minimaal 40 dieren, 10 planten, 60 voorwerpen, 15 plaatsen', () => {
    const count = (c: string) => items.filter((i) => i.props.includes(c)).length;
    expect(count('dier')).toBeGreaterThanOrEqual(40);
    expect(count('plant')).toBeGreaterThanOrEqual(10);
    expect(count('voorwerp')).toBeGreaterThanOrEqual(60);
    expect(count('plaats')).toBeGreaterThanOrEqual(15);
  });

  it('item-ids zijn kebab-case en naam/emoji zijn niet leeg', () => {
    for (const item of items) {
      expect(item.id, item.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(item.name.trim().length, item.id).toBeGreaterThan(0);
      expect(item.emoji.trim().length, item.id).toBeGreaterThan(0);
    }
  });

  it('elk item vind je in huis of buiten', () => {
    for (const item of items) {
      const ok = item.props.includes('in_huis') || item.props.includes('buiten');
      expect(ok, item.id).toBe(true);
    }
  });

  it('overrides is een gewoon object', () => {
    expect(overrides).not.toBeNull();
    expect(Array.isArray(overrides)).toBe(false);
    expect(typeof overrides).toBe('object');
  });
});
