import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySave, checkRequest } from '../tools/portalPlugin';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'portal-'));
  mkdirSync(join(tmp, 'src', 'data'), { recursive: true });
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const read = (f: string) => readFileSync(join(tmp, 'src', 'data', f + '.json'), 'utf8');

describe('checkRequest', () => {
  const ok = { host: 'localhost:5173', 'content-type': 'application/json' };
  it('laat een geldige same-origin POST door', () => {
    expect(checkRequest('POST', '/__portal/save', ok)).toBeNull();
    expect(checkRequest('POST', '/__portal/save', { ...ok, origin: 'http://localhost:5173' })).toBeNull();
    expect(checkRequest('POST', '/__portal/save', { ...ok, 'content-type': 'application/json; charset=utf-8' })).toBeNull();
  });
  it('weigert vreemde Origin met 403', () => {
    expect(checkRequest('POST', '/__portal/save', { ...ok, origin: 'http://evil.example' })?.status).toBe(403);
    expect(checkRequest('POST', '/__portal/save', { ...ok, origin: 'null' })?.status).toBe(403);
  });
  it('weigert niet-JSON Content-Type', () => {
    expect(checkRequest('POST', '/__portal/save', { host: 'localhost:5173', 'content-type': 'text/plain' })?.status).toBe(415);
    expect(checkRequest('POST', '/__portal/save', { host: 'localhost:5173' })?.status).toBe(415);
  });
  it('controleert exact pad en methode', () => {
    expect(checkRequest('POST', '/__portal/save/extra', ok)?.status).toBe(404);
    expect(checkRequest('GET', '/__portal/save', ok)?.status).toBe(405);
    expect(checkRequest('POST', '/__portal/save?x=1', ok)).toBeNull();
  });
});

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

  it('valideert override-sleutels en regels', () => {
    applySave(tmp, 'overrides', {
      '2026-12-01': { t: 'and', a: { t: 'prop', id: 'x' }, b: { t: 'not', r: { t: 'prop', id: 'y' } } },
    });
    expect(() => applySave(tmp, 'overrides', { '2026-02-31': { t: 'prop', id: 'x' } })).toThrow();
    expect(() => applySave(tmp, 'overrides', { '2026-13-01': { t: 'prop', id: 'x' } })).toThrow();
    expect(() => applySave(tmp, 'overrides', { morgen: { t: 'prop', id: 'x' } })).toThrow();
    expect(() => applySave(tmp, 'overrides', { '2026-12-01': { t: 'prop' } })).toThrow();
    expect(() => applySave(tmp, 'overrides', { '2026-12-01': { t: 'xor' } })).toThrow();
    expect(() => applySave(tmp, 'overrides', { '2026-12-01': 'dier' })).toThrow();
    expect(() => applySave(tmp, 'overrides', { '2026-12-01': { t: 'not', r: null } })).toThrow();
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
