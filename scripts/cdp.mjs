// A headless Chrome driven over the DevTools protocol, for the measuring scripts (memRuns.mjs).
// Starts Chrome with a throwaway profile, attaches to its first page and hands back `send` and
// `evaluate`; close() kills Chrome and removes the profile.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function launchChrome({ port = 9338, args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'ps-cdp-'));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', ...args, 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 50 && !url; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      url = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    if (!url) await new Promise((r) => setTimeout(r, 200));
  }
  if (!url) throw new Error('Chrome never came up');
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) fail(new Error(msg.error.message));
      else ok(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  });
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = ++seq;
      pending.set(id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  /** The value of `expr` in the page, awaited if it is a promise. */
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    return r.result.value;
  };
  const close = async () => {
    ws.close();
    chrome.kill();
    await new Promise((r) => setTimeout(r, 500));
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome still holds a file; the temp folder can keep it
    }
  };
  return { send, evaluate, listeners, close };
}
