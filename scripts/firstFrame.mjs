// Times the first battle frame of a production build on a throttled phone: `npm run firstframe --
// dist [runs] [query]` (query: e.g. ?lang=zh). It serves the folder gzipped (as the portals and the CDN
// do), opens it as a new player in headless Chrome with DevTools' Fast 3G and a 4x slower CPU,
// and reads the `first_frame` mark boot() sets two frames after the first battle starts. Prints
// each run and the median; the collector is blocked, so nothing is counted.
// Build first with the collector off: VITE_ANALYTICS_URL= npx vite build

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = process.argv[2] ?? 'dist';
const runs = Number(process.argv[3] ?? 5);
const query = process.argv[4] ?? '';
const PORT = 5297;
const DEBUG_PORT = 9337;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// DevTools' Fast 3G preset
const NET = { offline: false, latency: 562.5, downloadThroughput: 180000, uploadThroughput: 84375 };
const CPU = 4;
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const GZIP = new Set(['.html', '.js', '.css', '.json', '.svg']);

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(dir, path === '/' ? 'index.html' : path));
  if (!file.startsWith(normalize(dir)) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  const ext = extname(file);
  const head = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
  if (GZIP.has(ext)) {
    res.writeHead(200, { ...head, 'content-encoding': 'gzip' }).end(gzipSync(readFileSync(file)));
    return;
  }
  res.writeHead(200, head);
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profile = mkdtempSync(join(tmpdir(), 'ps-firstframe-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome never came up');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) fail(new Error(`${msg.error.message}`));
    else ok(msg.result);
  } else if (msg.method) for (const l of listeners) l(msg);
});
const send = (method, params = {}, sessionId) =>
  new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
  });

// Pixi fetches the art from a web worker, its own target: with its Network domain on, the page's
// throttling covers its fetches too (and they are counted); without, they go at full speed
const workers = new Set();
listeners.push((m) => {
  if (m.method !== 'Target.attachedToTarget') return;
  const s = m.params.sessionId;
  workers.add(s);
  void (async () => {
    for (const [method, params] of [['Network.enable', {}], ['Network.setCacheDisabled', { cacheDisabled: true }]]) {
      await send(method, params, s).catch((err) => console.warn(`worker ${m.params.targetInfo.type}: ${method}: ${err.message}`));
    }
    await send('Runtime.runIfWaitingForDebugger', {}, s).catch(() => {});
  })();
});
listeners.push((m) => {
  if (m.method === 'Target.detachedFromTarget') workers.delete(m.params.sessionId);
});

await send('Network.enable');
await send('Page.enable');
await send('Runtime.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Network.setBlockedURLs', { urls: ['*gamestao.com*', '*crazygames.com*'] });
await send('Emulation.setDeviceMetricsOverride', PHONE);
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

// bytes per request that finished before the mark
const requests = new Map();
listeners.push((m) => {
  if (m.method === 'Network.requestWillBeSent') requests.set(`${m.sessionId ?? ''}:${m.params.requestId}`, { url: m.params.request.url, bytes: 0, done: false });
  if (m.method === 'Network.loadingFinished') {
    const r = requests.get(`${m.sessionId ?? ''}:${m.params.requestId}`);
    if (r) Object.assign(r, { bytes: m.params.encodedDataLength, done: true });
  }
});

const eval_ = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
const origin = `http://127.0.0.1:${PORT}`;
const times = [];
let gl = '';
for (let i = 0; i < runs; i++) {
  // a new player every run: nothing cached, nothing saved
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Page.navigate', { url: 'about:blank' });
  await new Promise((r) => setTimeout(r, 300));
  await send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
  await send('Network.clearBrowserCache');
  await send('Network.emulateNetworkConditions', NET);
  await send('Emulation.setCPUThrottlingRate', { rate: CPU });
  requests.clear();
  await send('Page.navigate', { url: `${origin}/${query}` });
  let ms;
  const t0 = Date.now();
  while (ms === undefined && Date.now() - t0 < 180000) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      ms = await eval_(`performance.getEntriesByName('first_frame')[0]?.startTime`);
    } catch {
      // the page is between documents
    }
  }
  if (ms === undefined) throw new Error('no first_frame mark within 3 minutes');
  if (!gl) gl = await eval_(`(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no webgl'; })()`);
  const done = [...requests.values()].filter((r) => r.done);
  const kb = done.reduce((a, r) => a + r.bytes, 0) / 1000;
  times.push(ms);
  console.log(`run ${i + 1}: first frame ${(ms / 1000).toFixed(2)} s, ${done.length} requests, ${kb.toFixed(0)} kB over the wire by then`);
  if (i === 0 && process.env.LIST) for (const r of done) console.log(`  ${(r.bytes / 1000).toFixed(1).padStart(7)} kB ${r.url.replace(origin, '')}`);
}
times.sort((a, b) => a - b);
console.log(`median first frame: ${(times[Math.floor(times.length / 2)] / 1000).toFixed(2)} s over ${runs} runs (Fast 3G, ${CPU}x CPU, ${PHONE.width}x${PHONE.height}@${PHONE.deviceScaleFactor}; GL: ${gl})`);

ws.close();
chrome.kill();
server.close();
await new Promise((r) => setTimeout(r, 500));
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  // Chrome still holds a file; the temp folder can keep it
}
