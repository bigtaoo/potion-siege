import { defineConfig, loadEnv } from 'vite';
import { buildDefine, buildId, defaultSource } from './scripts/buildId.mjs';
import { openBeacon } from './scripts/openBeacon.mjs';

// The iOS build: `npm run build:ios` writes dist-ios/, which `npx cap sync ios` copies into the
// Capacitor shell (capacitor.config.ts, docs/ios.md). The same page as the web build with
// src/main.ios.ts as its entry, rewritten on both hooks for the reason vite.crazygames.config.js
// gives; the build fails if the rewrite never ran rather than shipping the browser entry.
// Adapted from D:\standing\client\vite.ios.config.js. It also gets the `open_*` beacon as host
// ios (the page is capacitor://localhost, which the beacon counts).

const DEFAULT_ENTRY = '/src/main.ts';
const IOS_ENTRY = '/src/main.ios.ts';

const iosHtml = () => {
  let applied = false;
  let beacon = '';
  const apply = (html) => {
    let out = html.replace(DEFAULT_ENTRY, IOS_ENTRY);
    if (beacon && !out.includes('/b?h=ios')) out = out.replace('<head>', `<head>\n    ${beacon}`);
    if (out.includes(IOS_ENTRY)) applied = true;
    return out;
  };
  return {
    name: 'ios-html',
    enforce: 'pre',
    configResolved(config) {
      // the collector is VITE_ANALYTICS_URL (.env.production) without its /e
      const url = loadEnv(config.mode, process.cwd(), 'VITE_').VITE_ANALYTICS_URL;
      if (config.command === 'build' && url) beacon = openBeacon(url.replace(/\/e$/, ''), buildId(), 'ios', defaultSource());
    },
    transform(code, id) {
      return id.endsWith('.html') ? apply(code) : null;
    },
    transformIndexHtml: apply,
    closeBundle() {
      if (!applied) throw new Error('vite.ios.config.js: index.html was never rewritten for the iOS entry');
    },
  };
};

export default defineConfig({
  base: './',
  define: buildDefine(),
  plugins: [iosHtml()],
  server: { port: 5182, host: true },
  // Safari 15 is the oldest web view the shell runs in (iOS 15)
  build: { target: ['es2020', 'safari15'], outDir: 'dist-ios', emptyOutDir: true },
});
