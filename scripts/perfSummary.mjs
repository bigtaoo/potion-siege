// The perf section of `npm run report`: frame rates by GPU class and cores, long frames and long
// tasks a minute, memory growth by the run's place in the launch (`nth`, to spot what survives a
// run), and anomalies by kind. Pure over the event list, so the tests can feed it rows.

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** hardwareConcurrency as a coarse bucket; 0 (not given) is '?'. */
export function coresBucket(n) {
  if (!n) return '?';
  if (n <= 2) return '1-2';
  if (n <= 4) return '3-4';
  if (n <= 8) return '5-8';
  return '9+';
}

function group(rows, key) {
  const out = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(r);
  }
  return out;
}

/** Snapshots, minutes, median fps and p5, long frames a minute of a group of perf rows. */
function rates(rows) {
  const secs = rows.reduce((s, r) => s + (r.secs || 0), 0);
  return {
    n: rows.length,
    mins: Math.round((secs / 60) * 10) / 10,
    fps: median(rows.map((r) => r.fps)),
    p5: median(rows.map((r) => r.p5)),
    longPerMin: secs ? Math.round(((rows.reduce((s, r) => s + (r.long || 0), 0) * 60) / secs) * 10) / 10 : null,
  };
}

export function perfSummary(events) {
  const device = new Map(); // sid -> session_start props
  for (const e of events) if (e.name === 'session_start') device.set(e.sid, e.props);
  const perf = events.filter((e) => e.name === 'perf').map((e) => ({ ...e.props, gpu: device.get(e.sid)?.gpu ?? '?', cores: coresBucket(device.get(e.sid)?.cores) }));

  const byGpu = [...group(perf, (r) => r.gpu)].map(([gpu, rows]) => ({ gpu, ...rates(rows) })).sort((a, b) => b.n - a.n);
  const byCores = [...group(perf, (r) => r.cores)].map(([cores, rows]) => ({ cores, ...rates(rows) })).sort((a, b) => a.cores.localeCompare(b.cores));

  const lt = perf.filter((r) => typeof r.longMs === 'number');
  const ltSecs = lt.reduce((s, r) => s + (r.secs || 0), 0);
  const longTasks = {
    n: lt.length,
    msPerMin: ltSecs ? Math.round((lt.reduce((s, r) => s + r.longMs, 0) * 60) / ltSecs) : null,
    perMin: ltSecs ? Math.round(((lt.reduce((s, r) => s + (r.longN || 0), 0) * 60) / ltSecs) * 10) / 10 : null,
  };

  const byNth = [...group(perf, (r) => r.nth)].sort((a, b) => a[0] - b[0]).map(([nth, rows]) => {
    const heap = rows.filter((r) => typeof r.heapUp === 'number');
    return {
      nth,
      n: rows.length,
      nodes0: median(rows.map((r) => r.nodes - r.nodesUp)),
      nodesUp: median(rows.map((r) => r.nodesUp)),
      tex0: median(rows.map((r) => r.tex - r.texUp)),
      texUp: median(rows.map((r) => r.texUp)),
      heap0: median(heap.map((r) => r.heap - r.heapUp)),
      heapUp: median(heap.map((r) => r.heapUp)),
    };
  });

  const anomalies = new Map();
  for (const e of events) if (e.name === 'anomaly') anomalies.set(e.props.kind, (anomalies.get(e.props.kind) ?? 0) + 1);
  const errors = new Map();
  for (const e of events) {
    if (e.name !== 'anomaly' || (e.props.kind !== 'error' && e.props.kind !== 'rejection')) continue;
    const k = `${e.props.msg ?? ''}${e.props.src ? ` @ ${e.props.src}` : ''}`;
    errors.set(k, (errors.get(k) ?? 0) + 1);
  }

  return {
    snapshots: perf.length,
    why: Object.fromEntries([...group(perf, (r) => r.why)].map(([k, v]) => [k, v.length])),
    all: rates(perf),
    byGpu,
    byCores,
    longTasks,
    byNth,
    anomalies: Object.fromEntries([...anomalies].sort((a, b) => b[1] - a[1])),
    topErrors: [...errors].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

const cell = (v, w = 6) => String(v ?? '-').padStart(w);

export function printPerf(s, log = console.log) {
  log(`\n== Perf (${s.snapshots} snapshots: ${Object.entries(s.why).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}) ==`);
  if (!s.snapshots) return;
  log(`all: fps ${s.all.fps}  p5 ${s.all.p5}  long frames/min ${s.all.longPerMin}  over ${s.all.mins} battle min`);
  const table = (title, key, rows) => {
    log(`${title.padEnd(9)}${cell('n')}${cell('min', 7)}${cell('fps')}${cell('p5')}${cell('long/m', 8)}`);
    for (const r of rows) log(`  ${String(r[key]).padEnd(7)}${cell(r.n)}${cell(r.mins, 7)}${cell(r.fps)}${cell(r.p5)}${cell(r.longPerMin, 8)}`);
  };
  table('by gpu', 'gpu', s.byGpu);
  table('by cores', 'cores', s.byCores);
  log(s.longTasks.n ? `long tasks: ${s.longTasks.msPerMin} ms/min, ${s.longTasks.perMin}/min (${s.longTasks.n} snapshots)` : 'long tasks: not reported');
  log(`by nth run  ${cell('n')}${cell('nodes0', 8)}${cell('nodesUp', 8)}${cell('tex0')}${cell('texUp')}${cell('heap0', 7)}${cell('heapUp', 7)}`);
  for (const r of s.byNth) log(`  ${String(r.nth).padEnd(10)}${cell(r.n)}${cell(r.nodes0, 8)}${cell(r.nodesUp, 8)}${cell(r.tex0)}${cell(r.texUp)}${cell(r.heap0, 7)}${cell(r.heapUp, 7)}`);
  log(`anomalies: ${Object.entries(s.anomalies).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`);
  for (const [msg, n] of s.topErrors) log(`  ${String(n).padStart(4)}  ${msg}`);
}
