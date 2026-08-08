import { defineConfig } from 'vite';

// Dev server on 8091 — blobgame owns 8080, fpsgame owns 8090, so all three
// can run side by side.
export default defineConfig({
  server: {
    port: 8091,
    strictPort: true,
    open: true,
  },
  preview: {
    port: 8091,
    strictPort: true,
  },
});
