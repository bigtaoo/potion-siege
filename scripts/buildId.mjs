// The build id every telemetry event carries (`build`): the package version and the commit it
// was built from, e.g. 0.0.1+61b33eb, `-dirty` when tracked files had uncommitted changes, so the
// report can tell releases apart and group new players by the first build they played. Adapted
// from D:\standing\build\buildId.mjs. Without git (a tarball) it is the version alone.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const git = (args) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

const packageVersion = () => JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** `run` answers a git command with its trimmed output, '' when git fails; the tests fake both. */
export function buildId(run = git, version = packageVersion()) {
  const sha = run('rev-parse --short=7 HEAD');
  if (!sha) return version;
  return `${version}+${sha}${run('status --porcelain --untracked-files=no') ? '-dirty' : ''}`;
}

/** The acquisition source a build tags new players with when their link has no `?src=`: set by
 *  scripts/build-zip.mjs (PS_DEFAULT_SRC) for a portal that hosts its own copy, '' otherwise. */
export const defaultSource = () => (process.env.PS_DEFAULT_SRC ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);

/**
 * The iOS web bundle's version (docs/ios.md "Hot updates"): `<MARKETING_VERSION>.<build>` for the
 * one inside a shell, `<shell>.<n>` for a hot update, from PS_BUNDLE_VERSION, which only the iOS
 * workflows set. 0.0.0 elsewhere, which turns the update check off.
 */
export const bundleVersion = () => process.env.PS_BUNDLE_VERSION || '0.0.0';

/** Vite's `define` for them: `__PS_BUILD__`, `__PS_DEFAULT_SRC__` and `__PS_BUNDLE__` in the client. */
export const buildDefine = () => ({
  __PS_BUILD__: JSON.stringify(buildId()),
  __PS_DEFAULT_SRC__: JSON.stringify(defaultSource()),
  __PS_BUNDLE__: JSON.stringify(bundleVersion()),
});
