import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite warns on any chunk over 500 kB. After the admin panel was code-split
    // (routes.tsx lazy-loads every desk), two chunks legitimately sit above it
    // and neither is a problem to fix at the source:
    //   • renderPdf (~1.2 MB) — the `@react-pdf/renderer` library. It is
    //     ALREADY lazy: `import('../pdf/renderPdf')` only runs when an admin
    //     generates a document, so it never touches the collector's initial
    //     load. The size is the library's; it cannot be trimmed without
    //     dropping PDF export.
    //   • index (~540 kB) — the collector app plus React and the router. The
    //     lazy split already took it from ~975 kB to here; the rest is the
    //     framework and the app's own shared code.
    // So the limit is raised to clear those two rather than left to cry wolf on
    // every build. Keep it a real ceiling: if a NEW chunk crosses it, that is a
    // regression worth seeing — do not raise this further without a reason like
    // the two above.
    chunkSizeWarningLimit: 1300,
  },
});
