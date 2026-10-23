// What the game keeps from run to run, and what a battle frame throws away: `npm run memruns --
// [runs] [speed]`. Starts the dev server, opens it in headless Chrome as autoplay (?autoplay) and
// plays `runs` runs in a row (every third one endless), each from the home screen with every tab
// and two panels built first, the way a player goes home and back. After each run it collects
// the garbage and prints the JS heap and the live Pixi objects (Graphics, their contexts, Text,
// Sprite, all display objects, those on stage, GPU textures, GPU texture MB by kind and how many
// art uploads were repeats after Pixi's texture GC dropped them). A heap or a count that climbs from
// run to run is a leak. Last it samples 10 s of one battle at speed 1 and prints the allocation
// rate and the functions that allocate the most. Numbers: ref/design/memory-audit.md.

import { spawn } from 'node:child_process';
import { launchChrome } from './cdp.mjs';

const runs = Number(process.argv[2] ?? 12);
const speed = Number(process.argv[3] ?? 8);
// PORT and CDP_PORT move it off 5299 and 9338 when another measurement is running beside it
const PORT = Number(process.env.PORT ?? 5299);
/** Real seconds a run may take before it is left where it is and the next one starts. */
const RUN_MAX_S = Number(process.env.RUN_MAX_S ?? 90);

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const origin = `http://localhost:${PORT}`;
for (let i = 0; ; i++) {
  try {
    if ((await fetch(origin)).ok) break;
  } catch {
    if (i > 100) throw new Error('the dev server never came up');
  }
  await new Promise((r) => setTimeout(r, 200));
}

console.error('dev server up');
const { send, evaluate, close } = await launchChrome({ port: Number(process.env.CDP_PORT ?? 9338), args: ['--window-size=430,932', '--enable-precise-memory-info'] });
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: `${origin}/?autoplay&speed=${speed}` });
for (let i = 0; i < 300 && !(await evaluate('!!window.__game?.battle').catch(() => false)); i++) await new Promise((r) => setTimeout(r, 200));

console.error('game up:', await evaluate('!!window.__game?.battle').catch((e) => e.message));
// in the page: the flows the game's own buttons call, and one of each Pixi object to count by
await evaluate(`(async () => {
  const g = window.__game;
  const [{ home }, { playEndless }] = await Promise.all([import('/src/game/homeScreen.ts'), import('/src/game/modes.ts')]);
  const frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  // by the render pipe, not the class name: the prebundled Pixi renames classes (Graphics2, ...)
  const find = (pipe) => { const s = [g.app.stage]; while (s.length) { const o = s.pop(); if (o.renderPipeId === pipe) return o; s.push(...(o.children ?? [])); } throw new Error('no ' + pipe + ' on stage'); };
  await frames(10);
  const graphics = find('graphics');
  // every GPU upload of a texture source, and which ones went up again after Pixi's GC dropped them
  const tex = g.app.renderer.texture, seen = new Set(), again = new Map();
  if (tex._initSource) {
    const init = tex._initSource.bind(tex);
    tex._initSource = (s) => { if (seen.has(s)) { const k = String(s.label || s.resource?.src || s.uid).split('/').pop(); again.set(k, (again.get(k) ?? 0) + 1); } seen.add(s); return init(s); };
  }
  window.__mem = {
    protos: { Graphics: Object.getPrototypeOf(graphics), GraphicsContext: Object.getPrototypeOf(graphics.context), Text: Object.getPrototypeOf(find('text')), Sprite: Object.getPrototypeOf(find('sprite')), Container: Object.getPrototypeOf(g.app.stage) },
    async run(kind, maxS) {
      for (const tab of ['potions', 'workshop', 'codex', 'shop', 'battle']) { g.tab = tab; home(g); await frames(2); }
      for (const panel of ['tasks', 'settings']) { home(g, panel); await frames(2); }
      home(g);
      await frames(2);
      if (kind === 'endless') playEndless(g);
      else {
        g.newBattle('autoplay');
        g.menu.visible = false;
        g.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
        g.root.visible = true;
      }
      const t0 = performance.now();
      while (!g.ended && performance.now() - t0 < maxS * 1000) await new Promise((r) => setTimeout(r, 250));
      const out = { kind, ended: g.ended, wave: g.battle.wave, secs: Math.round((performance.now() - t0) / 1000) };
      // the result screen, then autoplay's own next battle (ending.ts), before the next home
      if (g.ended) await new Promise((r) => setTimeout(r, 2000));
      return out;
    },
    counts() {
      const r = g.app.renderer;
      const live = (h) => Object.values(h?.items ?? {}).filter(Boolean).length;
      let stage = 0;
      const s = [g.app.stage];
      while (s.length) { const o = s.pop(); stage++; s.push(...(o.children ?? [])); }
      // GPU texture memory by kind: loaded art (an image behind it), text (a canvas), and sources with
      // nothing behind them (pooled scratch: returned text textures and filter or render targets)
      const srcs = (r.texture?.managedTextures ?? []).filter(Boolean);
      const mb = (f) => Math.round(srcs.filter(f).reduce((a, s) => a + s.pixelWidth * s.pixelHeight * 4, 0) / 2 ** 19) / 2;
      const reup = [...again.values()].reduce((a, n) => a + n, 0);
      return { stage, gpuContexts: live(r.graphicsContext?._managedContexts), gpuTex: srcs.length, textTex: live({ items: r.canvasText?._activeTextures }),
        artMB: mb((s) => s.resource && !s.resource.getContext), textMB: mb((s) => s.resource?.getContext), scratchMB: mb((s) => !s.resource), reup, reupWhat: [...again].map(([k, n]) => k + '×' + n).join(' ') };
    },
  };
})()`);

/** Live objects whose prototype chain holds `window.__mem.protos[name]`. */
async function liveCount(name) {
  const proto = await send('Runtime.evaluate', { expression: `window.__mem.protos.${name}` });
  const found = await send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId });
  const n = await send('Runtime.callFunctionOn', { objectId: found.objects.objectId, functionDeclaration: 'function () { return this.length; }', returnByValue: true });
  await send('Runtime.releaseObject', { objectId: found.objects.objectId });
  return n.result.value;
}

async function sample() {
  await send('HeapProfiler.collectGarbage');
  await send('HeapProfiler.collectGarbage');
  const heap = (await send('Runtime.getHeapUsage')).usedSize / 2 ** 20;
  const out = { heapMB: Math.round(heap * 10) / 10 };
  for (const name of ['Graphics', 'GraphicsContext', 'Text', 'Sprite', 'Container']) out[name] = await liveCount(name);
  return { ...out, ...(await evaluate('window.__mem.counts()')) };
}

await send('HeapProfiler.enable');
const rows = [{ run: 'start', ...(await sample()) }];
console.log(JSON.stringify(rows[0]));
for (let i = 1; i <= runs; i++) {
  const kind = i % 3 === 0 ? 'endless' : 'stage';
  const r = await evaluate(`window.__mem.run('${kind}', ${RUN_MAX_S})`);
  const row = { run: i, ...r, ...(await sample()) };
  rows.push(row);
  console.log(JSON.stringify(row));
}

// the allocation rate of a battle at normal speed, five seconds in
await evaluate(`(async () => { const g = window.__game; g.speed = 1; await window.__mem.run('stage', 5); })()`);
await send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await new Promise((r) => setTimeout(r, 10000));
const { profile } = await send('HeapProfiler.stopSampling');
const frames = await evaluate('new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (performance.now() - t0 < 2000 ? (n++, requestAnimationFrame(f)) : r(n / 2)); requestAnimationFrame(f); })');
const total = profile.samples.reduce((a, s) => a + s.size, 0);
const bySite = new Map();
const walk = (node) => {
  const f = node.callFrame;
  const key = `${f.functionName || '(anonymous)'} ${f.url.replace(/^.*\/(src|node_modules\/\.vite\/deps)\//, '').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
  bySite.set(key, (bySite.get(key) ?? 0) + node.selfSize);
  for (const c of node.children) walk(c);
};
walk(profile.head);

console.log('\nrun   kind     wave  secs  heapMB  Graphics  GfxCtx  Text  Sprite  Container  stage  gpuCtx  gpuTex  textTex');
for (const r of rows) {
  const c = (v, w) => String(v ?? '').padStart(w);
  console.log(`${c(r.run, 5)}  ${String(r.kind ?? '').padEnd(7)} ${c(r.wave, 5)} ${c(r.secs, 5)} ${c(r.heapMB, 7)} ${c(r.Graphics, 9)} ${c(r.GraphicsContext, 7)} ${c(r.Text, 5)} ${c(r.Sprite, 7)} ${c(r.Container, 10)} ${c(r.stage, 6)} ${c(r.gpuContexts, 7)} ${c(r.gpuTex, 7)} ${c(r.textTex, 8)} ${c(r.artMB, 6)} ${c(r.textMB, 7)} ${c(r.scratchMB, 10)} ${c(r.reup, 5)}`);
}
console.log(`\nuploaded again after Pixi's texture GC dropped them: ${rows.at(-1).reupWhat || 'none'}`);
console.log(`\nbattle at speed 1: ${(total / 2 ** 20 / 10).toFixed(2)} MB/s allocated, about ${frames} frames/s in headless Chrome`);
for (const [site, bytes] of [...bySite].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${(bytes / 2 ** 20 / 10).toFixed(3).padStart(7)} MB/s  ${site}`);

await close();
vite.kill();
