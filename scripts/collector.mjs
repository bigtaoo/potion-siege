// Minimal telemetry collector: accepts POSTed JSON arrays of events and appends them to an
// NDJSON file, one event per line. No dependencies, for local testing or a small VPS.
//
//   node scripts/collector.mjs [port] [file]      (defaults: 8787, telemetry/events.ndjson)
//   build with VITE_ANALYTICS_URL=http://host:8787/e
//   npm run report -- telemetry/events.ndjson

import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname } from 'node:path';

const port = Number(process.argv[2]) || 8787;
const file = process.argv[3] || 'telemetry/events.ndjson';
const MAX_BODY = 256 * 1024;
mkdirSync(dirname(file), { recursive: true });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (req.method !== 'POST' || req.url !== '/e') return res.writeHead(404, cors).end();
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
      if (lines) appendFileSync(file, lines + '\n');
      res.writeHead(204, cors).end();
    } catch {
      res.writeHead(400, cors).end();
    }
  });
}).listen(port, () => console.log(`collector on :${port}/e -> ${file}`));
