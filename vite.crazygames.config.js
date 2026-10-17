import { defineConfig, loadEnv } from 'vite';
import { buildDefine, buildId } from './scripts/buildId.mjs';

// The CrazyGames build: the same index.html, rewritten to boot the portal entry and to load the
// SDK script. Adapted from D:\standing\client\vite.crazygames.config.js.
// A build also gets the anonymous `open_*` load checkpoint as an inline script ahead of the SDK
// tag: a tick after it would miss every launch given up while the SDK itself downloads. The game
// sends `loaded_*` once its first battle frame is up (app.ts loadedBeacon), with the same
// desktop/touch test, so loaded / opened is the share of launches that got past loading. Both go
// to the collector's GET /b (scripts/collector.mjs), with no id, whatever the privacy state.
const SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
const DEFAULT_ENTRY = '/src/main.ts';
const PORTAL_ENTRY = '/src/main.crazygames.ts';

/** The inline `open_*` checkpoint: no id, no storage, nothing from a developer's own machine. */
export function openBeacon(collector, build) {
  return `<script>(function(){try{var h=location.hostname;if(h==='localhost'||h==='[::1]'||h.indexOf('127.')===0)return;var t=matchMedia('(pointer: coarse)').matches?'touch':'desktop';fetch(${JSON.stringify(`${collector}/b?h=crazygames&b=${encodeURIComponent(build)}&s=open_`)}+t,{mode:'no-cors',keepalive:true}).catch(function(){})}catch(e){}})()</script>`;
}

export function rewritePortalHtml(html, beacon = '') {
  let out = html;
  if (out.includes(DEFAULT_ENTRY)) out = out.replace(DEFAULT_ENTRY, PORTAL_ENTRY);
  if (!out.includes('sdk.crazygames.com')) out = out.replace('</head>', `    ${beacon}${beacon ? '\n    ' : ''}${SDK_TAG}\n  </head>`);
  return out;
}

const portalHtml = () => {
  let applied = false;
  let beacon = '';
  const apply = (html) => {
    const out = rewritePortalHtml(html, beacon);
    if (out.includes(PORTAL_ENTRY) && out.includes('sdk.crazygames.com')) applied = true;
    return out;
  };
  return {
    name: 'crazygames-html',
    enforce: 'pre',
    configResolved(config) {
      // the collector is VITE_ANALYTICS_URL (.env.production) without its /e
      const url = loadEnv(config.mode, process.cwd(), 'VITE_').VITE_ANALYTICS_URL;
      if (config.command === 'build' && url) beacon = openBeacon(url.replace(/\/e$/, ''), buildId());
    },
    // a build reaches the html through transform, dev through transformIndexHtml
    transform(code, id) {
      return id.endsWith('.html') ? apply(code) : null;
    },
    transformIndexHtml: apply,
    closeBundle() {
      if (!applied) throw new Error('index.html was never rewritten for the portal');
    },
  };
};

export default defineConfig({
  base: './',
  define: buildDefine(),
  plugins: [portalHtml()],
  server: { port: 5181, host: true },
  build: { target: 'es2020', outDir: 'dist-crazygames', emptyOutDir: true },
});
