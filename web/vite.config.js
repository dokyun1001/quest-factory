import { defineConfig } from 'vite';

// .gen/ is produced by tools/pack_web_assets.py (atlas pages + fonts)
export default defineConfig({
  base: './',
  publicDir: '.gen',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  server: { host: '127.0.0.1', port: 5173 },
});
