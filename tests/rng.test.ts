import { describe, it, expect } from 'vitest';
import { hashString, mulberry32, shuffle } from '../src/lib/rng';

describe('hashString', () => {
  it('is deterministic and distinguishes inputs', () => {
    expect(hashString('a')).toBe(hashString('a'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('golden values', () => {
  it('hashString matches FNV-1a 32-bit vectors', () => {
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('')).toBe(0x811c9dc5);
  });
  it('mulberry32(1) starts with pinned values', () => {
    const r = mulberry32(1);
    expect(r()).toBe(0.6270739405881613);
    expect(r()).toBe(0.002735721180215478);
    expect(r()).toBe(0.5274470399599522);
  });
});

describe('mulberry32', () => {
  it('gives the same first 5 values for the same seed, in [0,1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    const xs = Array.from({ length: 5 }, () => a());
    const ys = Array.from({ length: 5 }, () => b());
    expect(xs).toEqual(ys);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  const src = [5, 3, 9, 1, 7, 2, 8];
  it('preserves elements and does not mutate the original', () => {
    const copy = [...src];
    const out = shuffle(src, mulberry32(42));
    expect([...out].sort()).toEqual([...src].sort());
    expect(src).toEqual(copy);
    expect(out).not.toBe(src);
  });
  it('is deterministic for the same seed', () => {
    expect(shuffle(src, mulberry32(7))).toEqual(shuffle(src, mulberry32(7)));
  });
});
