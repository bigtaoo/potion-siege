import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';

export const COLORS = {
  bg: 0x0e1a2b,
  field: 0x24405e,
  fieldEdge: 0x1a3048,
  wall: 0x8a7a66,
  wallTop: 0xb3a38c,
  cell: 0x1b2f45,
  gold: 0xffcf3f,
  text: 0xffffff,
  dim: 0x000000,
  button: 0x2f9e5b,
  buttonOff: 0x7a6656,
  card: 0x1f3550,
  hpBack: 0x3a1010,
  hp: 0xe5484d,
};

export const HERO_COLORS = {
  arcane: 0xb46cff,
  fire: 0xff6a3d,
  ice: 0x6fd8ff,
  lightning: 0xffe14d,
  poison: 0x7ed957,
  wind: 0x8fe3c8,
} as const;

export function label(text: string, size: number, style: TextStyleOptions = {}): Text {
  const out = new Text({
    text,
    style: {
      fontFamily: 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: size,
      fontWeight: '800',
      fill: COLORS.text,
      stroke: { color: 0x0a1320, width: Math.max(4, size / 8) },
      align: 'center',
      ...style,
    },
  });
  out.anchor.set(0.5);
  return out;
}

/** A rounded button centred on its position; `setEnabled` greys it out. */
export class Button extends Container {
  private readonly bg = new Graphics();
  readonly text: Text;
  private enabled = true;

  constructor(
    caption: string,
    private readonly w: number,
    private readonly h: number,
    private readonly color: number,
    onTap: () => void,
    size = 56,
  ) {
    super();
    this.text = label(caption, size);
    this.addChild(this.bg, this.text);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => {
      if (this.enabled) onTap();
    });
    this.draw();
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.cursor = on ? 'pointer' : 'default';
    this.draw();
  }

  private draw(): void {
    const { w, h } = this;
    this.bg
      .clear()
      .roundRect(-w / 2, -h / 2 + 10, w, h, 36)
      .fill(0x0e0c12)
      .roundRect(-w / 2, -h / 2, w, h, 36)
      .fill(this.enabled ? this.color : COLORS.buttonOff)
      .stroke({ width: 7, color: 0x0e0c12 })
      // a light band along the top edge, like the cel-shaded art
      .roundRect(-w / 2 + 14, -h / 2 + 10, w - 28, 14, 7)
      .fill({ color: 0xffffff, alpha: 0.22 });
  }
}

/** The crystal, the currency kept between battles: a cut gem in the cel-shaded style. */
export function gem(g: Graphics, x: number, y: number, r: number): Graphics {
  const top = [x - r, y - r * 0.35, x - r * 0.55, y - r, x + r * 0.55, y - r, x + r, y - r * 0.35];
  return g
    .poly([...top, x, y + r])
    .fill(0x4fd6ff)
    .poly([x - r, y - r * 0.35, x + r, y - r * 0.35, x, y + r])
    .fill(0x2a9fd8)
    .poly([x - r * 0.55, y - r, x - r * 0.1, y - r, x - r * 0.45, y - r * 0.35])
    .fill(0xd8f7ff)
    .poly([...top, x, y + r])
    .stroke({ width: Math.max(3, r / 5), color: 0x0e0c12, join: 'round' });
}
