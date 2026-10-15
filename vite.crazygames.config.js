import { defineConfig } from 'vite';

// The CrazyGames build: the same index.html, rewritten to boot the portal entry and to load the
// SDK script. Adapted from D:\standing\client\vite.crazygames.config.js.
const SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
const DEFAULT_ENTRY = '/src/main.ts';
const PORTAL_ENTRY = '/src/main.crazygames.ts';

export function rewritePortalHtml(html) {
  let out = html;
  if (out.includes(DEFAULT_ENTRY)) out = out.replace(DEFAULT_ENTRY, PORTAL_ENTRY);
  if (!out.includes('sdk.crazygames.com')) out = out.replace('</head>', `    ${SDK_TAG}\n  </head>`);
  return out;
}

const portalHtml = () => {
  let applied = false;
  const apply = (html) => {
    const out = rewritePortalHtml(html);
    if (out.includes(PORTAL_ENTRY) && out.includes('sdk.crazygames.com')) applied = true;
    return out;
  };
  return {
    name: 'crazygames-html',
    enforce: 'pre',
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
  plugins: [portalHtml()],
  server: { port: 5181, host: true },
  build: { target: 'es2020', outDir: 'dist-crazygames', emptyOutDir: true },
});
