// Art for the view's tests in node: every file "loads" as a 1 x 1 texture of its own, so the code
// that draws art runs, and a canvas that has no 2D context, so the baked shapes fall back to white.

import { Assets, Texture } from 'pixi.js';
import { vi } from 'vitest';
import { loadArt, loadField, restOfArt } from './art';

export function noCanvas(): void {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
}

/** Loads every texture art.ts knows, and the chapters' fields from then on. */
export async function fakeArt(): Promise<void> {
  noCanvas();
  vi.spyOn(Assets, 'load').mockImplementation(async () => new Texture({ source: Texture.WHITE.source }) as never);
  await loadArt();
  await restOfArt();
}

/** Every chapter field in, so `show` finds it at once. */
export async function fakeFields(keys: readonly string[]): Promise<void> {
  for (const k of keys) await loadField(k);
}
