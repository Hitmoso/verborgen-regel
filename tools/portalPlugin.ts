import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const FILES = ['items', 'properties', 'overrides'] as const;
const MAX_BODY = 5 * 1024 * 1024;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Valideert vorm en bestandsnaam; schrijft pas daarna naar <rootDir>/src/data/<file>.json. */
export function applySave(rootDir: string, file: string, data: unknown): void {
  if (!(FILES as readonly string[]).includes(file)) {
    throw new Error(`Onbekend bestand: ${String(file)}`);
  }
  if (file === 'overrides') {
    if (!isPlainObject(data)) throw new Error('overrides moet een object zijn');
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
      server.middlewares.use('/__portal/save', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { error: 'Alleen POST' });
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
