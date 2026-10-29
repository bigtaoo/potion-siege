// What the collector (scripts/collector.mjs) lets one client address do, and how it reads a body
// off the wire, apart from the routes so both can be tested. Ported from Holy Kicker's server
// (D:\standing server/src/http.ts, routes.ts rateOf): a request is charged to its route's budget
// from the method, path and Content-Length alone, before a byte of its body is read, so a caller
// over its budget costs the box nothing more than the headers.

/** sendBeacon and fetch's keepalive both stop at 64 KB, so no event batch the game sends is larger. */
export const MAX_BODY = 64 * 1024;
/** A battle's replay (POST /r): a long endless run's commands come to well under this. */
export const MAX_REPLAY = 256 * 1024;

/**
 * Per client address and minute, per route: requests and body bytes. Behind the tunnel the
 * address is CF-Connecting-IP. Events and load checkpoints share one budget: a client sends a
 * batch every 15 s, and players can share an address. A replay goes once per battle and once
 * more when the page is hidden mid-battle.
 */
export const RATES = {
  events: { requests: 240, bytes: 1024 * 1024 },
  replays: { requests: 20, bytes: 4 * 1024 * 1024 },
};

/** The budget a request is charged to, from its method and path alone, or null for none. */
export function rateOf(method, url) {
  if (method === 'POST' && url === '/e') return 'events';
  if (method === 'GET' && url?.startsWith('/b?')) return 'events';
  if (method === 'POST' && url === '/r') return 'replays';
  return null;
}

export const addressOf = (req) => String(req.headers['cf-connecting-ip'] ?? req.socket?.remoteAddress ?? '');

/**
 * The country Cloudflare places the request in (its `CF-IPCountry` header, ISO 3166 two letters,
 * T1 for Tor), or undefined when it gives none or XX (unknown). Only the country is kept, never the
 * address (public/privacy.html §2).
 */
export function countryOf(req) {
  const c = req.headers['cf-ipcountry'];
  return typeof c === 'string' && /^(?:[A-Z]{2}|T1)$/.test(c) && c !== 'XX' ? c : undefined;
}

/** The body length the request declares, or 0 when it declares none (chunked: charged as read). */
export function declared(req) {
  const n = Number(req.headers['content-length']);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/**
 * Each route's requests and body bytes per address in the current minute. The log says, once a
 * minute, how many addresses went over a byte budget, never which.
 */
export class Limits {
  constructor(rates = RATES, now = Date.now, log = console.log) {
    this.rates = rates;
    this.now = now;
    this.log = log;
    this.minute = -1;
    this.tick();
  }

  tick() {
    const minute = Math.floor(this.now() / 60_000);
    if (minute === this.minute) return;
    for (const [name, b] of Object.entries(this.buckets ?? {})) {
      if (b.over) this.log(`collector: ${b.over} address(es) sent over ${this.rates[name].bytes} bytes in a minute (${name})`);
    }
    this.minute = minute;
    this.buckets = Object.fromEntries(Object.keys(this.rates).map((name) => [name, { requests: new Map(), bytes: new Map(), over: 0 }]));
  }

  /** Counts one request and its declared body; false when the address is over either budget. */
  allow(rate, ip, bytes = 0) {
    this.tick();
    const b = this.buckets[rate];
    const n = (b.requests.get(ip) ?? 0) + 1;
    b.requests.set(ip, n);
    if (n > this.rates[rate].requests || (b.bytes.get(ip) ?? 0) > this.rates[rate].bytes) return false;
    return !(bytes && this.spend(rate, ip, bytes));
  }

  /** Counts `n` body bytes against the address; true once it is over this minute's budget. */
  spend(rate, ip, n) {
    this.tick();
    const b = this.buckets[rate];
    const max = this.rates[rate].bytes;
    const was = b.bytes.get(ip) ?? 0;
    b.bytes.set(ip, was + n);
    if (was + n <= max) return false;
    if (was <= max) b.over++;
    return true;
  }
}

/** Replay bodies read at once; one more is turned away with 503, so slow uploads cannot pile up memory. */
export const BIG_READS = 32;
/** A body not fully read by then is cut off (408). */
export const BODY_MS = 20_000;

/** Counts the big bodies being read: take() before reading one (false: too many already), give() when done. */
export class BodyGate {
  constructor(limit = BIG_READS) {
    this.limit = limit;
    this.open = 0;
  }
  take() {
    if (this.open >= this.limit) return false;
    this.open++;
    return true;
  }
  give() {
    this.open = Math.max(0, this.open - 1);
  }
}

/** The status a body that could not be read is answered with. */
export const STATUS = { 'too large': 413, 'too slow': 408, 'over budget': 429 };

/**
 * Reads a request body as text and calls `done(null, text)`, or `done(reason)` once, with a
 * reason from STATUS or 'closed' (the client went away). `over(n)` is asked about each chunk's
 * bytes past what the request declared (those were charged up front) and cuts the body off when
 * it answers true. Callbacks, not a promise, so a body that has arrived is answered in the same
 * turn as its last chunk.
 */
export function readBody(req, { limit, ms = BODY_MS, over = () => false }, done) {
  let settled = false;
  let text = '';
  let size = 0;
  const free = declared(req);
  const finish = (err, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    done(err, value);
  };
  const cut = (reason) => {
    finish(reason);
    req.destroy();
  };
  const timer = setTimeout(() => cut('too slow'), ms);
  timer.unref?.();
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    if (settled) return;
    const n = Buffer.byteLength(chunk);
    const past = Math.max(0, size + n - Math.max(size, free));
    size += n;
    if (size > limit) return cut('too large');
    if (past && over(past)) return cut('over budget');
    text += chunk;
  });
  req.on('end', () => finish(null, text));
  req.on('error', () => finish('closed'));
  // a client gone mid-body may end with neither 'end' nor 'error'
  req.on('close', () => finish('closed'));
}
