import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Two projects, because this repo has two genuinely different kinds of test
 * and one environment cannot serve both honestly.
 *
 * **logic** — every `.test.ts`. Controllers, services, pure functions. They
 * run in `node` with no DOM, which is not a limitation but a property worth
 * keeping: it is what proves `QuestionnaireController` and `bankDetails`
 * survive an environment with no `localStorage` at all, which is the
 * private-window case. Giving the whole suite a DOM would quietly delete that
 * guarantee.
 *
 * **components** — every `.test.tsx`. Added 2026-09-22 to close Phase 13's
 * last row. These need `jsdom` and the React plugin for JSX.
 *
 * Still kept out of `vite.config.ts`: importing `vitest/config`'s
 * `defineConfig` into the app's own build config clashes with vite 8's
 * bundled types.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
