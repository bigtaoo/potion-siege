import { defineConfig, loadEnv } from 'vite';
import { buildDefine, buildId, defaultSource } from './scripts/buildId.mjs';
import { WATCH_IGNORED } from './scripts/devWatch.mjs';
import { openBeacon } from './scripts/openBeacon.mjs';

/** A build gets the anonymous `open_*` load checkpoint (scripts/openBeacon.mjs) as the first
 *  thing in <head>, so the web's launches count like the portal's. */
const webBeacon = () => {
  let beacon = '';
  return {
    name: 'web-open-beacon',
    configResolved(config) {
      // the collector is VITE_ANALYTICS_URL (.env.production) without its /e
      const url = loadEnv(config.mode, process.cwd(), 'VITE_').VITE_ANALYTICS_URL;
      if (config.command === 'build' && url) beacon = openBeacon(url.replace(/\/e$/, ''), buildId(), 'web', defaultSource());
    },
    transformIndexHtml: (html) => (beacon ? html.replace('<head>', `<head>\n    ${beacon}`) : html),
  };
};

export default defineConfig({
  define: buildDefine(),
  plugins: [webBeacon()],
  server: { port: 5180, host: true, watch: { ignored: WATCH_IGNORED } },
  build: { target: 'es2020', outDir: 'dist' },
  // 5 s is vitest's default; the sim-heavy tests pass it under the full suite's load on CI
  test: { include: ['src/**/*.test.ts'], testTimeout: 30_000 },
});
