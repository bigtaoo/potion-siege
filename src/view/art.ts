// Finished art from public/art/. Anything without a texture yet keeps its placeholder shape.

import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import type { EnemyKind, HeroKind } from '../sim/types';
import type { SkillId } from '../sim/skills';
import type { PotionLook } from './potion';

const FILES = [
  'hero_slime_1',
  'enemy_grunt',
  'icon_crit',
  'commander',
  'potion_fire_body',
  'potion_fire_ult',
  'potion_ice_body',
  'potion_lightning_body',
  'potion_ice_ult',
] as const;

const textures = new Map<string, Texture>();

export async function loadArt(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  await Promise.all(
    FILES.map(async (f) => {
      try {
        textures.set(f, await Assets.load<Texture>(`${base}art/${f}.png`));
      } catch (err) {
        console.warn(`art: ${f} failed to load, keeping the placeholder`, err);
      }
    }),
  );
}

/** The small figure a cell shows one to three of, for levels 1-3. */
const FIGURE: Partial<Record<HeroKind, string>> = { slime: 'hero_slime_1' };
/** The single big hero of the top level. */
const ULTIMATE: Partial<Record<HeroKind, string>> = { slime: 'hero_slime_1', fire: 'potion_fire_ult', ice: 'potion_ice_ult' };

export function figureTexture(kind: HeroKind): Texture | undefined {
  const f = FIGURE[kind];
  return f ? textures.get(f) : undefined;
}

export function ultimateTexture(kind: HeroKind): Texture | undefined {
  const f = ULTIMATE[kind];
  return f ? textures.get(f) : undefined;
}

/** Kinds drawn as living potions at levels 1-3: the bottle art and where its parts are. */
const POTIONS: Partial<Record<HeroKind, Omit<PotionLook, 'body'> & { file: string }>> = {
  fire: {
    file: 'potion_fire_body',
    eyes: [[0.333, 0.582], [0.674, 0.584]],
    eyeSize: [0.075, 0.072],
    lid: 0xfe9603,
    limb: 0xf26b1d,
    mark: 'flame',
    glow: [0xe8361c, 0xff9a1f, 0xffe25a],
    neck: [0.505, 0.05],
  },
  ice: {
    file: 'potion_ice_body',
    eyes: [[0.305, 0.543], [0.662, 0.543]],
    eyeSize: [0.065, 0.058],
    lid: 0x11f9f9,
    limb: 0x14bfdc,
    mark: 'frost',
    glow: [0x3fb8e6, 0xa8f4ff, 0xffffff],
    neck: [0.5, 0.05],
  },
  lightning: {
    file: 'potion_lightning_body',
    eyes: [[0.311, 0.428], [0.672, 0.43]],
    eyeSize: [0.1, 0.12],
    lid: 0xfed501,
    limb: 0xe0a000,
    mark: 'spark',
    glow: [0xf5b800, 0xffe94a, 0xffffff],
    neck: [0.49, 0.03],
  },
};

export function potionLook(kind: HeroKind): PotionLook | undefined {
  const p = POTIONS[kind];
  const body = p && textures.get(p.file);
  return p && body ? { ...p, body } : undefined;
}

export function commanderTexture(): Texture | undefined {
  return textures.get('commander');
}

export function enemyTexture(kind: EnemyKind): Texture | undefined {
  return textures.get(`enemy_${kind}`);
}

export function iconTexture(id: SkillId): Texture | undefined {
  return textures.get(`icon_${id}`);
}

/** Sprites reused frame to frame: call begin(), then put() each one to draw, then end(). */
export class SpriteLayer extends Container {
  private used = 0;

  begin(): void {
    this.used = 0;
  }

  /** A sprite standing with its feet at (x, y), `h` design units tall. */
  put(tex: Texture, x: number, y: number, h: number): Sprite {
    let s = this.children[this.used] as Sprite | undefined;
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 1);
      this.addChild(s);
    }
    this.used++;
    s.texture = tex;
    s.visible = true;
    s.position.set(x, y);
    s.scale.set(h / tex.height);
    s.rotation = 0;
    s.alpha = 1;
    s.tint = 0xffffff;
    return s;
  }

  end(): void {
    for (let i = this.used; i < this.children.length; i++) this.children[i].visible = false;
  }
}
