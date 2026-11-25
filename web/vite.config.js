import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsDir: 'qf006', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
