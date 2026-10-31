import { describe, expect, it } from 'vitest';
import { addPreloads, startChunks } from '../../scripts/pixiPreload.mjs';

// The modulepreload links every build's page gets for Pixi's lazy renderer chunks
// (scripts/pixiPreload.mjs).

const chunk = (fileName: string, o: { name?: string; imports?: string[]; isEntry?: boolean; isDynamicEntry?: boolean } = {}) => ({
  type: 'chunk',
  fileName,
  name: o.name ?? fileName,
  imports: o.imports ?? [],
  isEntry: o.isEntry ?? false,
  isDynamicEntry: o.isDynamicEntry ?? false,
});

const bundle = Object.fromEntries(
  [
    chunk('assets/index-a.js', { isEntry: true, imports: ['assets/shared-s.js'] }),
    chunk('assets/shared-s.js'),
    chunk('assets/WebGLRenderer-w.js', { name: 'WebGLRenderer', isDynamicEntry: true, imports: ['assets/Filter-f.js', 'assets/shared-s.js'] }),
    chunk('assets/Filter-f.js'),
    chunk('assets/browserAll-b.js', { name: 'browserAll', isDynamicEntry: true }),
    chunk('assets/WebGPURenderer-g.js', { name: 'WebGPURenderer', isDynamicEntry: true }),
    { type: 'asset', fileName: 'assets/index-a.css' },
  ].map((c) => [c.fileName, c]),
);

describe('startChunks', () => {
  it('takes the start chunks and what they import, less what the entry fetches already', () => {
    expect(startChunks(bundle)).toEqual(['assets/Filter-f.js', 'assets/WebGLRenderer-w.js', 'assets/browserAll-b.js']);
  });
});

describe('addPreloads', () => {
  const page = (src: string) => `<head>\n    <script type="module" crossorigin src="${src}assets/index-a.js"></script>\n  </head>`;

  it("writes each link with the base of the page's own script", () => {
    for (const base of ['/', './']) {
      const html = addPreloads(page(base), ['assets/Filter-f.js'], 'assets/index-a.js');
      expect(html).toContain(`<link rel="modulepreload" crossorigin href="${base}assets/Filter-f.js">\n  </head>`);
    }
  });

  it('leaves a page without the entry, or with nothing to add, as it is', () => {
    expect(addPreloads(page('/'), ['assets/Filter-f.js'], 'assets/other.js')).toBe(page('/'));
    expect(addPreloads(page('/'), [], 'assets/index-a.js')).toBe(page('/'));
    expect(addPreloads(page('/'), ['assets/Filter-f.js'], undefined)).toBe(page('/'));
  });
});
