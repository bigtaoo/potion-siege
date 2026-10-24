// scripts/collector.mjs run in-process for its tests (collector*.test.ts): node:http hands its
// request handler to the test instead of opening a port, and node:fs writes to a map. Each test
// file mocks the two modules with these fakes:
//
//   vi.mock('node:http', async () => (await import('./collectorHarness')).fakeHttp);
//   vi.mock('node:fs', async () => (await import('./collectorHarness')).fakeFs);
//
// The state sits on globalThis, since load() resets the module registry and with it this module.
// (No @types/node here, so the little of node the tests touch is declared by hand.)

import { vi } from 'vitest';

declare const process: { argv: string[] };

export type Handler = (req: FakeReq, res: FakeRes) => void;

interface State {
  handler: Handler | null;
  port: number;
  files: Map<string, string | Uint8Array>;
  mtimes: Map<string, number>;
  /** Size statSync reports instead of the real one, e.g. to stand for a full file. */
  sizeOverride: number | null;
  dirs: string[];
  /** Bytes statfsSync reports free, and whether accessSync refuses to write. */
  free: number;
  readOnly: boolean;
}

const g = globalThis as unknown as { collectorHarness?: State };
export const state: State = (g.collectorHarness ??= {
  handler: null,
  port: 0,
  files: new Map(),
  mtimes: new Map(),
  sizeOverride: null,
  dirs: [],
  free: 10 * 1024 ** 3,
  readOnly: false,
});

export function resetState(): void {
  state.files.clear();
  state.mtimes.clear();
  state.dirs.length = 0;
  state.sizeOverride = null;
  state.free = 10 * 1024 ** 3;
  state.readOnly = false;
}

export const fakeHttp = {
  createServer: (handler: Handler) => {
    state.handler = handler;
    return {
      listen: (port: number, cb?: () => void) => {
        state.port = port;
        cb?.();
      },
    };
  },
};

// paths with / on every OS: node:path's join gives \ on Windows
const key = (path: string) => path.replace(/\\/g, '/');
const missing = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

export const fakeFs = {
  constants: { W_OK: 2 },
  mkdirSync: (dir: string) => {
    state.dirs.push(key(dir));
  },
  appendFileSync: (file: string, text: string) => {
    const was = state.files.get(key(file)) ?? '';
    state.files.set(key(file), String(was) + text);
  },
  writeFileSync: (file: string, data: Uint8Array) => {
    state.files.set(key(file), data);
    state.mtimes.set(key(file), Date.now());
  },
  renameSync: (from: string, to: string) => {
    const data = state.files.get(key(from));
    if (data === undefined) throw missing();
    state.files.delete(key(from));
    state.files.set(key(to), data);
    state.mtimes.set(key(to), state.mtimes.get(key(from)) ?? Date.now());
  },
  utimesSync: (file: string, _atime: number, mtime: number) => {
    state.mtimes.set(key(file), mtime * 1000);
  },
  /** The names in `dir` itself, not in the directories below it. */
  readdirSync: (dir: string) => {
    const prefix = `${key(dir)}/`;
    const names = [...state.files.keys()].filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length).split('/')[0]);
    return [...new Set(names)];
  },
  readFileSync: (file: string) => {
    const data = state.files.get(key(file));
    if (data === undefined) throw missing();
    return data;
  },
  unlinkSync: (file: string) => {
    if (!state.files.delete(key(file))) throw missing();
  },
  statSync: (file: string) => {
    if (state.sizeOverride !== null) return { size: state.sizeOverride, mtimeMs: 0 };
    const data = state.files.get(key(file));
    if (data === undefined) throw missing();
    return { size: data.length, mtimeMs: state.mtimes.get(key(file)) ?? 0 };
  },
  statfsSync: () => ({ bavail: Math.floor(state.free / 4096), bsize: 4096 }),
  accessSync: () => {
    if (state.readOnly) throw Object.assign(new Error('EROFS'), { code: 'EROFS' });
  },
};

export class FakeReq {
  readonly socket = { remoteAddress: '10.0.0.1' };
  readonly destroy = vi.fn();
  private readonly listeners = new Map<string, ((chunk?: string) => void)[]>();
  constructor(
    readonly method: string,
    readonly url: string,
    readonly headers: Record<string, string> = {},
  ) {}
  setEncoding(): void {}
  on(event: string, fn: (chunk?: string) => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
    return this;
  }
  emit(event: string, chunk?: string): void {
    for (const fn of this.listeners.get(event) ?? []) fn(chunk);
  }
}

export class FakeRes {
  status = 0;
  headers: Record<string, string> = {};
  body: string | undefined;
  ended = false;
  writeHead(status: number, headers: Record<string, string> = {}): this {
    this.status = status;
    this.headers = headers;
    return this;
  }
  end(body?: string): this {
    this.body = body;
    this.ended = true;
    return this;
  }
}

export const NOON = Date.UTC(2026, 9, 18, 12);
export const DIR = '/data';
export const dayFile = (day: string) => `${DIR}/events-${day}.ndjson`;
export const TODAY = dayFile('2026-10-18');

/** Loads a fresh copy of the collector (new rate-limit state) with these env and argv. */
export async function load(env: { COLLECTOR_DIR?: string; PORT?: string; COLLECTOR_REPLAY_BYTES?: string } = { COLLECTOR_DIR: DIR }, argv: string[] = []) {
  vi.resetModules();
  state.handler = null;
  vi.stubEnv('COLLECTOR_DIR', env.COLLECTOR_DIR);
  vi.stubEnv('PORT', env.PORT);
  vi.stubEnv('COLLECTOR_REPLAY_BYTES', env.COLLECTOR_REPLAY_BYTES);
  const saved = process.argv;
  process.argv = ['node', 'collector.mjs', ...argv];
  try {
    await import('../../scripts/collector.mjs');
  } finally {
    process.argv = saved;
  }
  if (!state.handler) throw new Error('collector did not create a server');
  return state.handler;
}

/** Sends one request, with `body` (POST) in the given chunks, and returns the response. */
export function request(handler: Handler, method: string, url: string, body?: string | string[], headers?: Record<string, string>) {
  const req = new FakeReq(method, url, headers);
  const res = new FakeRes();
  handler(req, res);
  if (body !== undefined) {
    for (const chunk of Array.isArray(body) ? body : [body]) req.emit('data', chunk);
    req.emit('end');
  }
  return { req, res };
}

/** The lines of an NDJSON file, parsed. */
export const lines = (file: string) =>
  String(state.files.get(file) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
