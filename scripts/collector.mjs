// Minimal telemetry collector: accepts POSTed JSON arrays of events and appends them to NDJSON,
// one event per line. No dependencies; runs locally and, in server/, on the VPS behind a
// Cloudflare Tunnel at https://ps.gamestao.com/e.
//
//   node scripts/collector.mjs [port] [file]      (defaults: 8787, telemetry/events.ndjson)
//   build with VITE_ANALYTICS_URL=http://host:8787/e
//   npm run report -- telemetry/events.ndjson
//
// With COLLECTOR_DIR set (the container does) it writes one file per UTC day instead,
// <dir>/events-YYYY-MM-DD.ndjson. GET /health answers 200 for the container's healthcheck.

import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';

const port = Number(process.env.PORT) || Number(process.argv[2]) || 8787;
const dir = process.env.COLLECTOR_DIR;
const single = process.argv[3] || 'telemetry/events.ndjson';
const MAX_BODY = 256 * 1024;
/** A day's file stops growing past this, so a flood cannot fill the disk. */
const MAX_FILE = 512 * 1024 * 1024;
/** Requests per client address per minute; a client sends one every 15 s, and players can share an address. */
const PER_MINUTE = 240;
mkdirSync(dir ?? dirname(single), { recursive: true });

const fileFor = (now) => (dir ? join(dir, `events-${new Date(now).toISOString().slice(0, 10)}.ndjson`) : single);
const sizeOf = (file) => {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// requests per address in the current minute; behind the tunnel the address is CF-Connecting-IP
let minute = 0;
let counts = new Map();
const limited = (req) => {
  const now = Math.floor(Date.now() / 60_000);
  if (now !== minute) {
    minute = now;
    counts = new Map();
  }
  const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '');
  const n = (counts.get(ip) ?? 0) + 1;
  counts.set(ip, n);
  return n > PER_MINUTE;
};

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (req.method !== 'POST' || req.url !== '/e') return res.writeHead(404, cors).end();
  if (limited(req)) return res.writeHead(429, cors).end();
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) req.destroy();
  });
  req.on('end', () => {
    try {
      const events = JSON.parse(body);
      if (!Array.isArray(events)) throw new Error('not an array');
      const received = Date.now();
      const lines = events
        .filter((e) => e && typeof e.name === 'string' && typeof e.uid === 'string')
        .map((e) => JSON.stringify({ ...e, received }))
        .join('\n');
      const file = fileFor(received);
      if (lines && sizeOf(file) < MAX_FILE) appendFileSync(file, lines + '\n');
      res.writeHead(204, cors).end();
    } catch {
      res.writeHead(400, cors).end();
    }
  });
}).listen(port, () => console.log(`collector on :${port}/e -> ${dir ? join(dir, 'events-<day>.ndjson') : single}`));
