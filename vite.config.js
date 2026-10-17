import { defineConfig } from 'vite';
import { buildDefine } from './scripts/buildId.mjs';

export default defineConfig({
  define: buildDefine(),
  server: { port: 5180, host: true },
  build: { target: 'es2020', outDir: 'dist' },
  test: { include: ['src/**/*.test.ts'] },
});
