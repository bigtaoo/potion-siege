import type { AppUpdates } from './types';

// Dev stand-in for the iOS app's hot updates (?ota=fake, ?ota=fail; game/switches.ts keeps them
// out of a release): an update on every check whose download takes a few seconds and then
// reloads the page, or stops at 60% and fails.

export function fakeUpdates(fail: boolean, reload: () => void = () => location.reload()): AppUpdates {
  const install = (progress: (f: number) => void) =>
    new Promise<void>((resolve, reject) => {
      let f = 0;
      const step = setInterval(() => {
        f = Math.min(1, f + 0.04);
        progress(f);
        if (fail && f >= 0.6) {
          clearInterval(step);
          reject(new Error('fake download failed'));
        } else if (f >= 1) {
          clearInterval(step);
          setTimeout(() => {
            resolve();
            reload();
          }, 600);
        }
      }, 120);
    });
  return { check: () => new Promise((r) => setTimeout(() => r({ version: '9.9.9.1', install }), 500)) };
}

/** The stand-in a `?ota=` switch asks for, if any. */
export function updatesSwitch(params: URLSearchParams): AppUpdates | undefined {
  const v = params.get('ota');
  return v === 'fake' || v === 'fail' ? fakeUpdates(v === 'fail') : undefined;
}
