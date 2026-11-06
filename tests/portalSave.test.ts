import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySave } from '../tools/portalPlugin';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'portal-'));
  mkdirSync(join(tmp, 'src', 'data'), { recursive: true });
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const read = (f: string) => readFileSync(join(tmp, 'src', 'data', f + '.json'), 'utf8');

describe('applySave', () => {
  it('schrijft overrides {}', () => {
    applySave(tmp, 'overrides', {});
    expect(read('overrides')).toBe('{}\n');
  });

  it('schrijft items []', () => {
    applySave(tmp, 'items', []);
    expect(read('items')).toBe('[]\n');
  });

  it('schrijft properties met inspringing', () => {
    applySave(tmp, 'properties', [{ id: 'a', label: 'b', negLabel: 'c' }]);
    expect(JSON.parse(read('properties'))).toEqual([{ id: 'a', label: 'b', negLabel: 'c' }]);
    expect(read('properties')).toContain('\n  {');
  });

  it('weigert onbekende bestanden en schrijft niets', () => {
    expect(() => applySave(tmp, '../evil', {})).toThrow();
    expect(() => applySave(tmp, 'package', {})).toThrow();
    expect(readdirSync(join(tmp, 'src', 'data'))).toEqual([]);
    expect(existsSync(join(tmp, 'src', 'evil.json'))).toBe(false);
  });

  it('weigert de verkeerde vorm', () => {
    expect(() => applySave(tmp, 'items', {})).toThrow();
    expect(() => applySave(tmp, 'items', [1])).toThrow();
    expect(() => applySave(tmp, 'items', [null])).toThrow();
    expect(() => applySave(tmp, 'overrides', [])).toThrow();
    expect(() => applySave(tmp, 'overrides', null)).toThrow();
    expect(readdirSync(join(tmp, 'src', 'data'))).toEqual([]);
  });
});
