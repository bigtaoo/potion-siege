import type { Props } from './analytics';
import { errorProps } from './perfReport';

// Errors thrown before the anomaly reporter is up (Anomalies.listen runs late in boot, app.ts):
// caught from the first import of app.ts on and handed to the reporter as it starts listening
// (ported from standing's net/earlyErrors.ts). Only the first EARLY_MAX are kept.

export const EARLY_MAX = 10;

export interface EarlyError {
  kind: 'error' | 'rejection';
  props: Props;
}

type ErrorTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

let caught: EarlyError[] = [];
let detach: (() => void) | null = null;

function message(x: unknown): string {
  return x instanceof Error ? x.message : String(x ?? '');
}

/** Starts catching window errors and unhandled rejections; a no-op without a window or once catching. */
export function catchEarlyErrors(win: ErrorTarget | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (detach || typeof win?.addEventListener !== 'function') return;
  const keep = (e: EarlyError) => {
    if (caught.length < EARLY_MAX) caught.push(e);
  };
  const onError = (e: ErrorEvent) => keep({ kind: 'error', props: errorProps(e.message || message(e.error), e.filename, e.lineno, e.colno) });
  const onRejection = (e: PromiseRejectionEvent) => keep({ kind: 'rejection', props: errorProps(message(e.reason)) });
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  detach = () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
  };
}

/** Everything caught so far, oldest first; stops catching (the reporter's own listeners take over). */
export function takeEarlyErrors(): EarlyError[] {
  detach?.();
  detach = null;
  const out = caught;
  caught = [];
  return out;
}

catchEarlyErrors();
