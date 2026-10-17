// The build id every telemetry event carries (`build`): the package version and the commit it
// was built from, e.g. 0.0.1+61b33eb, `-dirty` when tracked files had uncommitted changes, so the
// report can tell releases apart and group new players by the first build they played. Adapted
// from D:\standing\build\buildId.mjs. Without git (a tarball) it is the version alone.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (args) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

export function buildId() {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const sha = git('rev-parse --short=7 HEAD');
  if (!sha) return version;
  return `${version}+${sha}${git('status --porcelain --untracked-files=no') ? '-dirty' : ''}`;
}

/** Vite's `define` for it: `__PS_BUILD__` in the client. */
export const buildDefine = () => ({ __PS_BUILD__: JSON.stringify(buildId()) });
