// scripts/nativeDiff.mjs: what counts as a native change between a shell's commit and HEAD, which
// ota-ios.yml refuses a hot update over and release-ios.yml refuses under the same version.

import { describe, expect, it } from 'vitest';
import { NATIVE_PATHS, nativeChanges } from '../../../scripts/nativeDiff.mjs';
import otaWorkflow from '../../../.github/workflows/ota-ios.yml?raw';
import releaseWorkflow from '../../../.github/workflows/release-ios.yml?raw';

const lock = (pkgs: Record<string, string>) => ({
  packages: { '': { name: 'potion-siege' }, ...Object.fromEntries(Object.entries(pkgs).map(([k, v]) => [`node_modules/${k}`, { version: v }])) },
});

describe('nativeChanges', () => {
  it('lists changed files the shell compiles in, and nothing else', () => {
    const files = ['ios/App/App/Info.plist', 'capacitor.config.ts', 'src/platform/ios/bridge.ts', 'src/platform/ios/ota.ts', 'src/main.ts', 'iosnotes.md', 'docs/ios.md'];
    expect(nativeChanges(files, lock({}), lock({}))).toEqual(['ios/App/App/Info.plist', 'capacitor.config.ts', 'src/platform/ios/bridge.ts']);
  });

  it('lists @capacitor and @capgo packages that moved, came or went', () => {
    const before = lock({ '@capacitor/core': '8.0.0', '@capgo/capacitor-updater': '7.1.0', '@capacitor/app': '8.0.0', pixi: '8.1.0' });
    const after = lock({ '@capacitor/core': '8.0.1', '@capgo/capacitor-updater': '7.1.0', '@capacitor/haptics': '8.0.0', pixi: '8.2.0' });
    expect(nativeChanges([], before, after)).toEqual(['@capacitor/app 8.0.0 -> none', '@capacitor/core 8.0.0 -> 8.0.1', '@capacitor/haptics none -> 8.0.0']);
    expect(nativeChanges(['package-lock.json'], before, before)).toEqual([]);
  });

  it('covers the bridge, the one web file the shell is built against', () => {
    expect(NATIVE_PATHS).toContain('src/platform/ios/bridge.ts');
    expect(NATIVE_PATHS).toContain('ios/');
  });
});

describe('the iOS workflows use it', () => {
  it('ota-ios refuses native changes since the newest shell, on main only, and gates on its version', () => {
    expect(otaWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(otaWorkflow).toContain('node scripts/nativeDiff.mjs "$SHELL_SHA"');
    expect(otaWorkflow).toContain('echo "min_native=$MV"');
    expect(otaWorkflow).not.toContain('inputs.min_native');
    expect(otaWorkflow).toContain('fetch-depth: 0');
  });

  it('release-ios needs green ci and a new MARKETING_VERSION for native changes', () => {
    expect(releaseWorkflow).toContain('--workflow ci.yml --commit "$GITHUB_SHA" --status success');
    expect(releaseWorkflow).toContain('node scripts/nativeDiff.mjs "$PREV"');
    expect(releaseWorkflow).toContain('fetch-depth: 0');
  });
});
