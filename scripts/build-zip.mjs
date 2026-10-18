// A copy of the web build for a portal that hosts the files itself (itch.io, Newgrounds): every
// path relative (base './'), new players tagged with the portal as their source even though its
// iframe drops our `?src=` (PS_DEFAULT_SRC, scripts/buildId.mjs), and zipped with index.html at
// the top as both sites want it. Telemetry goes to the collector in .env.production as usual.
//
//   npm run build:itch          -> dist-itch/, potion-siege-itch.zip
//   npm run build:newgrounds    -> dist-newgrounds/, potion-siege-newgrounds.zip
//   node scripts/build-zip.mjs <source tag>

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const src = (process.argv[2] ?? '').toLowerCase();
if (!/^[a-z0-9._-]{1,40}$/.test(src)) {
  console.error('usage: node scripts/build-zip.mjs <source tag, e.g. itch>');
  process.exit(1);
}
process.env.PS_DEFAULT_SRC = src;
const outDir = `dist-${src}`;
const zipFile = `potion-siege-${src}.zip`;

const { build } = await import('vite');
await build({ configFile: 'vite.config.js', base: './', build: { outDir, emptyOutDir: true } });

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(outDir);
writeFileSync(zipFile, zip(files.map((path) => ({ name: relative(outDir, path).split(sep).join('/'), data: readFileSync(path) }))));
console.log(`${zipFile}: ${files.length} files from ${outDir}/, new players tagged src=${src}`);

/** A plain zip (deflate, no extras) of `entries`. */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const packed = deflateRawSync(data, { level: 9 });
    const stored = packed.length >= data.length;
    const body = stored ? data : packed;
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data) >>> 0;
    const head = (sig, extra) => {
      const b = Buffer.alloc(extra ? 46 : 30);
      b.writeUInt32LE(sig, 0);
      let o = 4;
      if (extra) b.writeUInt16LE(20, o), (o += 2); // made by
      b.writeUInt16LE(20, o); // version needed
      b.writeUInt16LE(0x0800, o + 2); // utf-8 names
      b.writeUInt16LE(stored ? 0 : 8, o + 4);
      b.writeUInt16LE(0, o + 6); // time
      b.writeUInt16LE(0x21, o + 8); // date 1980-01-01
      b.writeUInt32LE(crc, o + 10);
      b.writeUInt32LE(body.length, o + 14);
      b.writeUInt32LE(data.length, o + 18);
      b.writeUInt16LE(nameBuf.length, o + 22);
      if (extra) b.writeUInt32LE(offset, 42);
      return b;
    };
    const local = Buffer.concat([head(0x04034b50, false), nameBuf, body]);
    central.push(Buffer.concat([head(0x02014b50, true), nameBuf]));
    locals.push(local);
    offset += local.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}
