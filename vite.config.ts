import { defineConfig } from 'vitest/config';
import { portalPlugin } from './tools/portalPlugin.ts';

export default defineConfig({
  plugins: [portalPlugin()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
