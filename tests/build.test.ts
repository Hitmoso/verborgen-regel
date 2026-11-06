import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('publicatiebuild', () => {
  it('bevat het spel maar niet het portaal', () => {
    const out = mkdtempSync(join(tmpdir(), 'vr-build-'));
    try {
      execSync(`npx vite build --outDir "${out}" --emptyOutDir`, {
        stdio: 'pipe',
        timeout: 60_000,
      });
      expect(existsSync(join(out, 'index.html'))).toBe(true);
      expect(existsSync(join(out, 'portal'))).toBe(false);
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
        );
      for (const f of walk(out)) {
        const text = readFileSync(f, 'utf8');
        expect(text, f).not.toContain('__portal');
        expect(text, f).not.toContain('Developerportaal');
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 90_000);
});
