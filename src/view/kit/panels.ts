// The surfaces of the workshop menus: the wall behind them, walnut and cream boards in brass
// frames, insets, tiles, cards, name plates and the round brass medallion.

import { Container, Graphics } from 'pixi.js';
import { label } from '../ui';
import { LIGHT, P } from './palette';
import { fit } from './text';

/** The workshop wall behind the menus (and beside the battle on a wide screen): pale planks,
 *  lit warm in the middle. */
export function workshopWall(w: number, h: number): Graphics {
  const g = new Graphics().rect(0, 0, w, h).fill(LIGHT.wall);
  for (let x = 0, i = 0; x < w; x += 150, i++) {
    g.rect(x, 0, 150, h).fill(i % 2 ? LIGHT.wall : LIGHT.wallAlt);
    g.rect(x, 0, 5, h).fill(LIGHT.wallSeam);
  }
  for (let i = 6; i > 0; i--) g.ellipse(w / 2, h * 0.45, w * 0.1 * i, h * 0.08 * i).fill({ color: 0xfff6e0, alpha: 0.06 });
  return g;
}

/** A walnut board in a brass frame with a rivet in each corner, centred on its position. */
export function woodPanel(w: number, h: number): Graphics {
  const g = new Graphics();
  const x = -w / 2;
  const y = -h / 2;
  g.roundRect(x, y + 12, w, h, 40).fill({ color: P.line, alpha: 0.6 });
  g.roundRect(x, y, w, h, 40).fill(P.brassDark).stroke({ width: 6, color: P.line });
  g.roundRect(x + 6, y + 6, w - 12, h - 18, 34).fill(P.brass);
  g.roundRect(x + 20, y + 12, w - 40, 8, 4).fill({ color: P.brassLight, alpha: 0.8 });
  g.roundRect(x + 22, y + 24, w - 44, h - 46, 24).fill(P.wood).stroke({ width: 4, color: P.line });
  // planks: a seam every so often, and a darker shade along the top under the frame
  g.roundRect(x + 24, y + 26, w - 48, 18, 8).fill({ color: P.woodDark, alpha: 0.7 });
  for (let py = y + 130; py < y + h - 60; py += 110) g.rect(x + 30, py, w - 60, 4).fill({ color: P.woodDark, alpha: 0.55 });
  for (const [rx, ry] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 26], [x + w - 22, y + h - 26]]) {
    g.circle(rx, ry, 10).fill(P.brassLight).stroke({ width: 4, color: P.line });
  }
  return g;
}

/** A cream board in a brass frame with a rivet in each corner, centred on its position: the
 *  light panel for content in dark ink. */
export function lightPanel(w: number, h: number): Graphics {
  const g = new Graphics();
  const x = -w / 2;
  const y = -h / 2;
  g.roundRect(x, y + 12, w, h, 40).fill({ color: P.line, alpha: 0.6 });
  g.roundRect(x, y, w, h, 40).fill(P.brassDark).stroke({ width: 6, color: P.line });
  g.roundRect(x + 6, y + 6, w - 12, h - 18, 34).fill(P.brass);
  g.roundRect(x + 20, y + 12, w - 40, 8, 4).fill({ color: P.brassLight, alpha: 0.8 });
  g.roundRect(x + 22, y + 24, w - 44, h - 46, 24).fill(LIGHT.face).stroke({ width: 4, color: LIGHT.edge });
  // a soft line inside the edge, like a page in a book
  g.roundRect(x + 38, y + 40, w - 76, h - 78, 16).stroke({ width: 3, color: LIGHT.seam });
  for (const [rx, ry] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 26], [x + w - 22, y + h - 26]]) {
    g.circle(rx, ry, 10).fill(P.brassLight).stroke({ width: 4, color: P.line });
  }
  return g;
}

/** A sunken greige field on the light board, centred across and from `y` down. */
export function inset(w: number, h: number, y = -h / 2, r = 28): Graphics {
  return new Graphics().roundRect(-w / 2, y, w, h, r).fill(LIGHT.inset).stroke({ width: 4, color: LIGHT.insetEdge });
}

/** A raised tile on the light board, with a darker lip along the bottom, centred on its position. */
export function lightTile(w: number, h: number, r = 24): Graphics {
  const x = -w / 2;
  const y = -h / 2;
  return new Graphics()
    .roundRect(x, y + 6, w, h, r)
    .fill({ color: P.line, alpha: 0.18 })
    .roundRect(x, y, w, h, r)
    .fill(LIGHT.tileLip)
    .roundRect(x, y, w, h - 8, r)
    .fill(LIGHT.tile)
    .roundRect(x, y, w, h, r)
    .stroke({ width: 4, color: LIGHT.insetEdge });
}

/** A cream card with a darker lip along the bottom, centred on its position. */
export function paperCard(w: number, h: number, r = 26): Graphics {
  const x = -w / 2;
  const y = -h / 2;
  return new Graphics()
    .roundRect(x, y + 8, w, h, r)
    .fill({ color: P.line, alpha: 0.3 })
    .roundRect(x, y, w, h, r)
    .fill(LIGHT.cardLip)
    .roundRect(x, y, w, h - 10, r)
    .fill(LIGHT.card)
    .roundRect(x, y, w, h, r)
    .stroke({ width: 4, color: LIGHT.edge });
}

/** The plate colours: body, its darker edge and the highlight. */
const PLATE = {
  brass: [P.brass, P.brassDark, P.brassLight],
  red: [0xc9463d, 0x7e2421, 0xf08a7a],
} as const;

/** A brass (or red) name plate with ribbon tails, its text in cream. The plate is at most
 *  `maxW` wide (the tails reach 44 further each side); a longer text shrinks to fit. */
export function plate(text: string, size = 56, minW = 360, tone: keyof typeof PLATE = 'brass', maxW = Infinity): Container {
  const [body, dark, light] = PLATE[tone];
  const c = new Container();
  const t = fit(label(text, size, { fill: P.cream, stroke: { color: P.line, width: Math.max(5, size / 8) } }), maxW - 120);
  const w = Math.max(minW, t.width + 120);
  const h = size + 44;
  const g = new Graphics();
  for (const s of [-1, 1]) {
    const x0 = (s * w) / 2;
    g.poly([x0 - s * 30, -h / 2 + 18, x0 + s * 44, -h / 2 + 18, x0 + s * 24, 8, x0 + s * 44, h / 2 + 10, x0 - s * 30, h / 2 + 10])
      .fill(dark)
      .stroke({ width: 5, color: P.line, join: 'round' });
  }
  g.roundRect(-w / 2, -h / 2 + 6, w, h, 18).fill({ color: P.line, alpha: 0.5 });
  g.roundRect(-w / 2, -h / 2, w, h, 18).fill(dark);
  g.roundRect(-w / 2, -h / 2, w, h - 8, 18).fill(body);
  g.roundRect(-w / 2 + 16, -h / 2 + 8, w - 32, 8, 4).fill({ color: light, alpha: 0.9 });
  g.roundRect(-w / 2, -h / 2, w, h, 18).stroke({ width: 5, color: P.line });
  t.y = -3;
  c.addChild(g, t);
  return c;
}

/** A round brass medallion, the frame for icon buttons; the icon goes on top of it. */
export function medal(r: number, face: number = P.wood): Graphics {
  return new Graphics()
    .circle(0, 6, r)
    .fill({ color: P.line, alpha: 0.5 })
    .circle(0, 0, r)
    .fill(P.brassDark)
    .stroke({ width: 5, color: P.line })
    .circle(0, -3, r - 6)
    .fill(P.brass)
    .circle(0, 0, r * 0.72)
    .fill(face)
    .stroke({ width: 4, color: P.line });
}
