// Does the game draw the same after a lost WebGL context comes back? `npm run contextloss --
// [secs=8]`. Starts the dev server, plays an autoplay battle for `secs`, stops the game's own tick
// (Pixi still draws every frame) and takes two screenshots: the second shows the noise between two
// frames of the same scene. Then it
// loses the context with WEBGL_lose_context, restores it, and takes a third. Each is compared with
// the first, and so is one taken while the context is lost (to show the test can tell): the share of pixels that differ by more than 48 in a channel, and the mean difference.
// A restored context with blank textures shows up as a large share; one that matches stays near the
// noise. Last it opens the home screen and checks that too. Screenshots go to ref/ctxloss/.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChrome } from './cdp.mjs';

const secs = Number(process.argv[2] ?? 8);
// PORT and CDP_PORT move it off 5298 and 9337 when another measurement is running beside it
const PORT = Number(process.env.PORT ?? 5298);
const OUT = process.env.OUT ?? 'ref/ctxloss';

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
const { send, evaluate, close } = await launchChrome({ port: Number(process.env.CDP_PORT ?? 9337), args: ['--window-size=430,932'] });
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: `${origin}/?autoplay&quality=high` });
for (let i = 0; i < 300 && !(await evaluate('!!window.__game?.battle').catch(() => false)); i++) await new Promise((r) => setTimeout(r, 200));
await new Promise((r) => setTimeout(r, secs * 1000));

const frames = (n) => evaluate(`new Promise((r) => { let n = ${n}; const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
const shot = async () => (await send('Page.captureScreenshot', { format: 'png' })).data;
/** Loses the context and waits for the canvas to say so; restore() brings it back. */
const lose = () =>
  evaluate(`(async () => {
    const c = window.__game.app.canvas, gl = window.__game.app.renderer.gl;
    window.__ctxExt = gl.getExtension('WEBGL_lose_context');
    const lost = new Promise((r) => c.addEventListener('webglcontextlost', r, { once: true }));
    window.__ctxExt.loseContext();
    await lost;
  })()`);
const restore = () =>
  evaluate(`(async () => {
    const c = window.__game.app.canvas;
    const back = new Promise((r) => c.addEventListener('webglcontextrestored', r, { once: true }));
    window.__ctxExt.restoreContext();
    await back;
    return window.__game.app.renderer.gl.isContextLost();
  })()`);
/** Share of pixels off by more than 48 in a channel, and the mean channel difference, b against a. */
const diff = (a, b) =>
  evaluate(`(async () => {
    const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + d; });
    const [ia, ib] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const pa = px(ia), pb = px(ib);
    let off = 0, sum = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
      if (d > 48) off++;
      sum += d;
    }
    const n = pa.length / 4;
    return { off: Math.round((off / n) * 1000) / 10 + '%', mean: Math.round((sum / n) * 10) / 10 };
  })()`);

mkdirSync(OUT, { recursive: true });
const save = (name, d) => writeFileSync(`${OUT}/${name}.png`, Buffer.from(d, 'base64'));
const check = async (where) => {
  await frames(10);
  const a = await shot();
  await frames(10);
  const b = await shot();
  await lose();
  await new Promise((r) => setTimeout(r, 300));
  const lost = await shot();
  const stillLost = await restore();
  await frames(10);
  const c = await shot();
  const errors = await evaluate('window.__ctxErrors.splice(0)');
  save(`${where}-before`, a);
  save(`${where}-after`, c);
  console.log(`${where}: noise ${JSON.stringify(await diff(a, b))}, while lost ${JSON.stringify(await diff(a, lost))}, after restore ${JSON.stringify(await diff(a, c))}${stillLost ? ', context still lost' : ''}${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`);
};

await evaluate(`window.__ctxErrors = []; addEventListener('error', (e) => window.__ctxErrors.push(e.message)); addEventListener('unhandledrejection', (e) => window.__ctxErrors.push(String(e.reason)));`);
const freeze = () => evaluate('window.__game.tick = () => {}');
await freeze();
await check('battle');
await evaluate(`(async () => { const { home } = await import('/src/game/homeScreen.ts'); delete window.__game.tick; home(window.__game); })()`);
await frames(20);
await freeze();
await check('home');

await close();
vite.kill();
