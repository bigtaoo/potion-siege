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
  buttonOff: 0x4a5866,
  card: 0x1f3550,
  hpBack: 0x3a1010,
  hp: 0xe5484d,
};

export const HERO_COLORS = {
  slime: 0x8ee6c0,
  fire: 0xff6a3d,
  ice: 0x6fd8ff,
  lightning: 0xffe14d,
  poison: 0xb072ff,
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
      .fill(0x000000)
      .roundRect(-w / 2, -h / 2, w, h, 36)
      .fill(this.enabled ? this.color : COLORS.buttonOff)
      .stroke({ width: 6, color: 0xffffff, alpha: 0.25 });
  }
}
