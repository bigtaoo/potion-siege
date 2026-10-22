import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { buildDefine, buildId, defaultSource } from './scripts/buildId.mjs';
import { WATCH_IGNORED } from './scripts/devWatch.mjs';
import { openBeacon } from './scripts/openBeacon.mjs';

// The CrazyGames build: the same index.html, rewritten to boot the portal entry and to load the
// SDK script. Adapted from D:\standing\client\vite.crazygames.config.js.
// A build also gets the anonymous `open_*` load checkpoint (scripts/openBeacon.mjs) as an inline
// script ahead of the SDK tag: a tick after it would miss every launch given up while the SDK
// itself downloads. The portal's zip leaves out public/privacy.html: the game links to the policy
// on p.gamestao.com, and a copy inside the zip would be one more to keep current.
const SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
const DEFAULT_ENTRY = '/src/main.ts';
const PORTAL_ENTRY = '/src/main.crazygames.ts';

export function rewritePortalHtml(html, beacon = '') {
  let out = html;
  if (out.includes(DEFAULT_ENTRY)) out = out.replace(DEFAULT_ENTRY, PORTAL_ENTRY);
  if (!out.includes('sdk.crazygames.com')) out = out.replace('</head>', `    ${beacon}${beacon ? '\n    ' : ''}${SDK_TAG}\n  </head>`);
  return out;
}

const portalHtml = () => {
  let applied = false;
  let beacon = '';
  let outDir = '';
  const apply = (html) => {
    const out = rewritePortalHtml(html, beacon);
    if (out.includes(PORTAL_ENTRY) && out.includes('sdk.crazygames.com')) applied = true;
    return out;
  };
  return {
    name: 'crazygames-html',
    enforce: 'pre',
    configResolved(config) {
      outDir = config.build.outDir;
      // the collector is VITE_ANALYTICS_URL (.env.production) without its /e
      const url = loadEnv(config.mode, process.cwd(), 'VITE_').VITE_ANALYTICS_URL;
      if (config.command === 'build' && url) beacon = openBeacon(url.replace(/\/e$/, ''), buildId(), 'crazygames', defaultSource());
    },
    // a build reaches the html through transform, dev through transformIndexHtml
    transform(code, id) {
      return id.endsWith('.html') ? apply(code) : null;
    },
    transformIndexHtml: apply,
    closeBundle() {
      if (!applied) throw new Error('index.html was never rewritten for the portal');
      rmSync(join(outDir, 'privacy.html'), { force: true });
    },
  };
};

export default defineConfig({
  base: './',
  define: buildDefine(),
  plugins: [portalHtml()],
  server: { port: 5181, host: true, watch: { ignored: WATCH_IGNORED } },
  build: { target: 'es2020', outDir: 'dist-crazygames', emptyOutDir: true },
});
