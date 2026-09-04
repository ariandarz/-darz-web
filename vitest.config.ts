import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts: the client tests are plain `.ts` (no
// JSX), so they need no plugins, and pulling `vitest/config` into the app's
// build config clashes with vite 8's bundled types.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
