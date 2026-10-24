// npm run framecost -- <dist> <horde|endless> [secs=20]: what a battle frame costs, measured in headless Chrome.
// Needs a dev build (NODE_ENV=development vite build --mode development --minify false --outDir <dist>)
// for ?autoplay, __game and readable names in the profile. horde: stage 1 from its first rush;
// endless: an endless run fast-forwarded to wave WAVE (20), then played at 1x.
// Seeds Math.random so both builds play the same battle; ?quality=high holds the resolution at 3.
// 4x CPU, 390x844@3, headless Chrome.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const [dir, mode = 'horde', secsArg = '20'] = process.argv.slice(2);
const secs = Number(secsArg);
const T = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = normalize(join(dir, p === '/' ? 'index.html' : p));
  if (!existsSync(f) || statSync(f).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
// PORT and CDP_PORT move it off 5299 and 9339 when another measurement is running beside it
const PORT = Number(process.env.PORT ?? 5299), CDP = Number(process.env.CDP_PORT ?? 9339);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const prof = mkdtempSync(join(tmpdir(), 'ps-fc-'));
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [`--remote-debugging-port=${CDP}`, `--user-data-dir=${prof}`, '--headless=new', '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pend = new Map();
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } });
const send = (method, params = {}) => new Promise((ok) => { const id = ++seq; pend.set(id, (x) => ok(x.result ?? x.error)); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable'); await send('Runtime.enable'); await send('Performance.enable');
await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['*crazygames.com*', '*gamestao.com*'] });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
// mulberry32: the same seed and effects in both builds
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let a=12345;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})()` });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?autoplay&quality=high` });
for (let i = 0; i < 300; i++) { await sleep(200); try { if (await ev(`!!window.__game?.battle`)) break; } catch {} }
await sleep(2000);

const b = () => `__game.battle`;
if (mode === 'endless') {
  // fast-forward an endless run to a late wave, then play it at 1x
  const target = Number(process.env.WAVE ?? 20);
  // a fresh save's potions fall around wave 4: the wall is kept full (in both builds alike)
  // the page drops back to 1x on the first frame of that wave, so both builds stop at the same point
  await ev(`__game.newBattle('endless'); __game.speed = 25; setInterval(() => { const b = __game.battle; if (b) b.wall = b.wallMax = 2 ** 30; }, 20);
    (function w() { if (__game.battle.wave >= ${target}) __game.speed = 1; else requestAnimationFrame(w); })(); true`);
  for (let i = 0; i < 1200; i++) { await sleep(250); if (await ev(`__game.speed === 1 || !!__game.battle.result`)) break; }
} else {
  // the horde opener: start once its first rush is on the road (AT enemies, default 10)
  const at = Number(process.env.AT ?? 10);
  for (let i = 0; i < 400; i++) { await sleep(50); if ((await ev(`${b()}.enemies.length`)) >= at) break; }
}
await send('Emulation.setCPUThrottlingRate', { rate: 4 });

// over the whole window: the Graphics contexts the renderer rebuilds and their shapes, per frame
await ev(`(()=>{const s=__game.app.renderer.graphicsContext;const o=s.updateGpuContext;window.__gc={n:0,ins:0};
s.updateGpuContext=function(c){if(c.dirty){__gc.n++;__gc.ins+=c.instructions.length};return o.apply(this,arguments)};
window.__fr=[];window.__en=[];(function f(t){__fr.push(t);__en.push(${b()}?.enemies.length??-1);requestAnimationFrame(f)})(performance.now());return true})()`);
const m0 = Object.fromEntries((await send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 500 }); await send('Profiler.start');
await sleep(secs * 1000);
const { profile } = await send('Profiler.stop');
const m1 = Object.fromEntries((await send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const fr = await ev(`(()=>{const d=[];const g=__gc;for(let i=1;i<__fr.length;i++)d.push(__fr[i]-__fr[i-1]);return {d,ctx:g.n/(__fr.length-1),shapes:g.ins/(__fr.length-1),en:__en,wave:${b()}.wave,res:__game.app.renderer.resolution,aa:__game.app.renderer.gl?.getContextAttributes().antialias}})()`);
const frames = fr.d.length;
const ds = fr.d.slice().sort((x, y) => x - y);
const script = m1.ScriptDuration - m0.ScriptDuration;

// inclusive time of the Graphics rebuild functions, share of busy time
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const WANT = ['updateGpuContext', 'buildContextBatches', 'buildLine', 'buildSimpleUvs'];
const incl = Object.fromEntries(WANT.map((w) => [w, 0]));
let total = 0, idle = 0;
profile.samples.forEach((s, i) => {
  const d = profile.timeDeltas[i] ?? 0;
  total += d;
  if (byId.get(s).callFrame.functionName === '(idle)' || byId.get(s).callFrame.functionName === '(program)') { idle += d; return; }
  const seen = new Set();
  for (let id = s; id !== undefined; id = parent.get(id)) {
    const fn = byId.get(id).callFrame.functionName;
    if (fn in incl && !seen.has(fn)) { seen.add(fn); incl[fn] += d; }
  }
});
const busy = total - idle;
const pct = (k) => +(100 * incl[k] / busy).toFixed(1);
console.log(JSON.stringify({
  dir: dir.split(/[\\/]/).pop(), mode, wave: fr.wave, maxEnemies: Math.max(...fr.en), meanEnemies: +(fr.en.reduce((a, x) => a + x, 0) / fr.en.length).toFixed(0),
  res: fr.res, antialias: fr.aa, frames, intervalMedian: +ds[frames >> 1].toFixed(1), intervalP95: +ds[Math.floor(frames * 0.95)].toFixed(1),
  scriptMsPerFrame: +(1000 * script / frames).toFixed(2),
  rebuildPct: pct('updateGpuContext'), rebuildMsPerFrame: +((script * 1000 / frames) * pct('updateGpuContext') / 100).toFixed(2),
  buildContextBatchesPct: pct('buildContextBatches'), buildLinePct: pct('buildLine'),
  rebuiltContextsPerFrame: +fr.ctx.toFixed(1), rebuiltShapesPerFrame: +fr.shapes.toFixed(1),
}));
ws.close(); chrome.kill(); server.close();
await sleep(300);
process.exit(0);
