// What changed on the native side of the iOS app between a shell's commit and HEAD (docs/ios.md
// "Hot updates"). A hot update carries only dist-ios, so ota-ios.yml refuses one when anything a
// shell compiles in moved since the shell it is made for, and release-ios.yml refuses a new shell
// that changes it under the same MARKETING_VERSION (the version hot updates gate on).
//
//   node scripts/nativeDiff.mjs <shell-commit>    prints each change; exit 1 when there is one

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files and folders compiled into the shell, or the contract with what is. */
export const NATIVE_PATHS = ['ios/', 'capacitor.config.ts', 'src/platform/ios/bridge.ts'];
/** Packages with a native half: their pods build into the shell. */
const NATIVE_PACKAGE = /^node_modules\/@(capacitor|capgo)\//;

const versions = (lock) =>
  Object.fromEntries(Object.entries(lock?.packages ?? {}).filter(([k]) => NATIVE_PACKAGE.test(k)).map(([k, v]) => [k, v?.version ?? '']));

/** The native changes among `files` (paths changed since the shell) and two package-lock.json objects. */
export function nativeChanges(files, lockBefore, lockAfter) {
  const out = files.filter((f) => NATIVE_PATHS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));
  const a = versions(lockBefore);
  const b = versions(lockAfter);
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (a[k] !== b[k]) out.push(`${k.slice('node_modules/'.length)} ${a[k] ?? 'none'} -> ${b[k] ?? 'none'}`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try {
    git('cat-file', '-e', `${base}^{commit}`);
  } catch {
    console.error(`nativeDiff: ${base || '(no commit given)'} is not a commit here (a shallow checkout?)`);
    process.exit(2);
  }
  const files = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
  const lock = (rev) => JSON.parse(git('show', `${rev}:package-lock.json`));
  const changes = nativeChanges(files, lock(base), lock('HEAD'));
  for (const c of changes) console.log(c);
  process.exit(changes.length ? 1 : 0);
}
