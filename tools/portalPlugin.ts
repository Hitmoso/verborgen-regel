import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { isValidDateKey } from '../src/lib/date';

const FILES = ['items', 'properties', 'overrides'] as const;
const MAX_BODY = 5 * 1024 * 1024;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isRule(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (v.t === 'prop') return typeof v.id === 'string';
  if (v.t === 'not') return isRule(v.r);
  if (v.t === 'and') return isRule(v.a) && isRule(v.b);
  return false;
}

/** Controleert methode, pad, Content-Type en Origin. Geeft een fout of null (= doorgaan). */
export function checkRequest(
  method: string | undefined,
  url: string | undefined,
  headers: Record<string, string | string[] | undefined>,
): { status: number; error: string } | null {
  const path = (url ?? '').split('?')[0];
  if (path !== '/__portal/save') return { status: 404, error: 'Niet gevonden' };
  if (method !== 'POST') return { status: 405, error: 'Alleen POST' };
  const origin = headers.origin;
  if (origin !== undefined) {
    let host = '';
    try {
      host = new URL(String(origin)).host;
    } catch {
      /* ongeldige origin: afgewezen hieronder */
    }
    if (!host || host !== headers.host) return { status: 403, error: 'Origin niet toegestaan' };
  }
  const ct = String(headers['content-type'] ?? '').toLowerCase();
  if (!ct.startsWith('application/json')) return { status: 415, error: 'Content-Type moet application/json zijn' };
  return null;
}

/** Valideert vorm en bestandsnaam; schrijft pas daarna naar <rootDir>/src/data/<file>.json. */
export function applySave(rootDir: string, file: string, data: unknown): void {
  if (!(FILES as readonly string[]).includes(file)) {
    throw new Error(`Onbekend bestand: ${String(file)}`);
  }
  if (file === 'overrides') {
    if (!isPlainObject(data)) throw new Error('overrides moet een object zijn');
    for (const [k, v] of Object.entries(data)) {
      if (!isValidDateKey(k)) throw new Error(`Ongeldige datum: ${k}`);
      if (!isRule(v)) throw new Error(`Ongeldige regel voor ${k}`);
    }
  } else {
    if (!Array.isArray(data) || !data.every(isPlainObject)) {
      throw new Error(`${file} moet een array van objecten zijn`);
    }
  }
  const text = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(join(rootDir, 'src', 'data', file + '.json'), text, { encoding: 'utf8' });
}

export function portalPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'verborgen-regel-portal',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path !== '/__portal/save') return next();
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        const bad = checkRequest(req.method, req.url, req.headers);
        if (bad) return send(bad.status, { error: bad.error });
        const chunks: Buffer[] = [];
        let size = 0;
        let aborted = false;
        req.on('data', (c: Buffer) => {
          if (aborted) return;
          size += c.length;
          if (size > MAX_BODY) {
            aborted = true;
            send(400, { error: 'Body te groot' });
            req.destroy();
            return;
          }
          chunks.push(c);
        });
        req.on('end', () => {
          if (aborted) return;
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
            if (!isPlainObject(body) || typeof body.file !== 'string') {
              throw new Error('Body moet { file, data } zijn');
            }
            applySave(root, body.file, body.data);
            send(200, { ok: true });
          } catch (e) {
            send(400, { error: e instanceof Error ? e.message : String(e) });
          }
        });
      });
    },
  };
}
