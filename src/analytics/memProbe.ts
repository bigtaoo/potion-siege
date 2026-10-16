// What the game holds in memory, for the `perf` and `anomaly` events: display objects on stage
// and GPU textures, besides the JS heap where the browser shows it. A leak that keeps sprites
// shows as nodes climbing; one that bakes or loads textures and never destroys them, as textures
// climbing; heap climbing with both flat points at plain JS (listeners, arrays, closures).

export interface MemSample {
  /** JS heap in use, MB; undefined where the browser does not say (only Chrome does). */
  heap?: number;
  tex: number;
  texMB: number;
  nodes: number;
}

interface Node {
  children?: readonly Node[];
}

/** Display objects in the tree under `root`, `root` included. Walked without recursion: a deep tree cannot blow the stack. */
export function countNodes(root: Node): number {
  let n = 0;
  const stack: Node[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    n++;
    const kids = node.children;
    if (kids) for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
  }
  return n;
}

/**
 * Texture count and size in MB (4 bytes a pixel, mipmaps left out) of a renderer's managed texture
 * sources. Pixi may leave a null where it unloaded one, so those are skipped.
 */
export function textureStats(sources: readonly ({ pixelWidth: number; pixelHeight: number } | null | undefined)[]): { tex: number; texMB: number } {
  let bytes = 0;
  let tex = 0;
  for (const s of sources) {
    if (!s) continue;
    tex++;
    bytes += (s.pixelWidth || 0) * (s.pixelHeight || 0) * 4;
  }
  return { tex, texMB: Math.round(bytes / 2 ** 20) };
}

/** Chrome's JS heap in MB; undefined where there is no performance.memory (Safari, Firefox). */
export function heapMB(perf: unknown = globalThis.performance): number | undefined {
  const used = (perf as { memory?: { usedJSHeapSize?: number } } | undefined)?.memory?.usedJSHeapSize;
  return typeof used === 'number' && used > 0 ? Math.round(used / 2 ** 20) : undefined;
}

/** Reads what the game holds now: the stage's display objects, the renderer's textures, the heap. */
export function memProbe(app: { stage: Node; renderer: unknown }): () => MemSample {
  return () => {
    const sources = (app.renderer as { texture?: { managedTextures?: readonly ({ pixelWidth: number; pixelHeight: number } | null)[] } }).texture?.managedTextures ?? [];
    const sample: MemSample = { ...textureStats(sources), nodes: countNodes(app.stage) };
    const heap = heapMB();
    if (heap !== undefined) sample.heap = heap;
    return sample;
  };
}
