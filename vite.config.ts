import { defineConfig } from 'vitest/config';
import { portalPlugin } from './tools/portalPlugin.ts';

export default defineConfig({
  // Relatieve paden: de build werkt op elk (sub)pad, ook GitHub Pages.
  base: './',
  plugins: [portalPlugin()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
