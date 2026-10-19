// Finished art from public/art/. Anything without a texture yet keeps its placeholder shape.

import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { HERO_KINDS, LINEUP, type EnemyKind, type HeroKind } from '../sim/types';
import type { SkillId } from '../sim/skills';
import type { PotionLook } from './potion';

/** What the first battle shows from its first frame: the field, the commander, the tutorial's
 *  glove, the starting four potions and the first wave's grunts. The first frame waits for these
 *  only (about a sixth of the art). */
const FIRST = ['bg_field.jpg', 'commander', 'tutorial_hand', 'enemy_grunt', ...LINEUP.map((k) => `potion_${k}_body`)];
/** Fetched right after: what the first battle comes to next (the skill cards show the
 *  ultimates and icons, runners and brutes walk in from waves 2 and 4) and the other potions. */
const SOON = [
  ...LINEUP.map((k) => `potion_${k}_ult`),
  'icon_allDamage',
  'icon_allSpeed',
  'icon_gold',
  'icon_wallRepair',
  'icon_crit',
  'enemy_runner',
  'enemy_brute',
  ...HERO_KINDS.filter((k) => !LINEUP.includes(k)).map((k) => `potion_${k}_body`),
];
/** Then the rest: the later stages' enemies, the bosses and the other ultimates. */
const LATER = [
  ...HERO_KINDS.filter((k) => !LINEUP.includes(k)).map((k) => `potion_${k}_ult`),
  'enemy_flyer',
  'enemy_winder',
  'enemy_boss',
  'enemy_clock',
  'enemy_tripod',
  'enemy_tripod_bare',
  'enemy_anvil',
  'enemy_gear',
  'enemy_gear_core',
];

/** The three in fetch order, for art.test.ts (every file in public/art once). */
export const ART_TIERS = { FIRST, SOON, LATER } as const;

const textures = new Map<string, Texture>();
let rest: Promise<void> = Promise.resolve();

function load(files: readonly string[]): Promise<void> {
  const base = import.meta.env.BASE_URL;
  return Promise.all(
    files.map(async (f) => {
      try {
        const file = f.includes('.') ? f : `${f}.png`;
        textures.set(f.replace(/\.\w+$/, ''), await Assets.load<Texture>(`${base}art/${file}`));
      } catch (err) {
        console.warn(`art: ${f} failed to load, keeping the placeholder`, err);
      }
    }),
  ).then(() => {});
}

/** Fetches the first battle's art and resolves once it is in; the rest follows on its own (see
 *  restOfArt). Anything that fails keeps its placeholder. */
export async function loadArt(): Promise<void> {
  await load(FIRST);
  rest = load(SOON).then(() => load(LATER));
}

/** Resolves once the art loadArt did not wait for is in too (or failed). Until then a texture
 *  getter can come back empty, as for art that never loaded. */
export function restOfArt(): Promise<void> {
  return rest;
}

/** The small figure a cell shows one to three of, for levels 1-3. */
const FIGURE: Partial<Record<HeroKind, string>> = {};
/** The single big hero of the top level. */
const ULTIMATE: Partial<Record<HeroKind, string>> = { arcane: 'potion_arcane_ult', fire: 'potion_fire_ult', ice: 'potion_ice_ult', lightning: 'potion_lightning_ult', poison: 'potion_poison_ult', wind: 'potion_wind_ult' };

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
  arcane: {
    file: 'potion_arcane_body',
    eyes: [[0.336, 0.53], [0.649, 0.53]],
    eyeSize: [0.09, 0.07],
    lid: 0x8a0dd0,
    limb: 0x7a1fc4,
    mark: 'star',
    glow: [0x9b3df0, 0xd9a6ff, 0xffffff],
    neck: [0.5, 0.04],
    size: 0.9,
  },
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
    size: 0.82,
  },
  poison: {
    file: 'potion_poison_body',
    eyes: [[0.288, 0.454], [0.682, 0.454]],
    eyeSize: [0.07, 0.056],
    lid: 0xdffd21,
    limb: 0xc0662c,
    mark: 'acid',
    glow: [0x4fb81c, 0x9cf03a, 0xeaffa0],
    neck: [0.48, 0.03],
  },
  wind: {
    file: 'potion_wind_body',
    eyes: [[0.325, 0.612], [0.699, 0.612]],
    eyeSize: [0.066, 0.06],
    lid: 0xb0f0ea,
    limb: 0x3fb8a8,
    mark: 'wind',
    glow: [0x2fae96, 0x9ff0d8, 0xffffff],
    neck: [0.5, 0.03],
    size: 0.9,
  },
};

/** Each kind's look, made once its art has loaded: asked for by every hero and vial every frame. */
const looks = new Map<HeroKind, PotionLook>();

export function potionLook(kind: HeroKind): PotionLook | undefined {
  const p = POTIONS[kind];
  const body = p && textures.get(p.file);
  if (!p || !body) return undefined;
  let look = looks.get(kind);
  if (look?.body !== body) looks.set(kind, (look = { ...p, body }));
  return look;
}

export function commanderTexture(): Texture | undefined {
  return textures.get('commander');
}

/** The chapter fields past the first, fetched only when a stage of theirs is chosen, so the
 *  first battle waits on none of them. */
const FIELDS = new Set(['bg_snow', 'bg_rail', 'bg_foundry', 'bg_clock']);
const fetching = new Map<string, Promise<Texture | undefined>>();

/** Starts fetching a chapter's field; resolves with it, or undefined when it cannot be had. */
export function loadField(key: string): Promise<Texture | undefined> {
  const have = textures.get(key);
  if (have || !FIELDS.has(key)) return Promise.resolve(have);
  let p = fetching.get(key);
  if (!p) {
    p = Assets.load<Texture>(`${import.meta.env.BASE_URL}art/${key}.jpg`).then(
      (t) => (textures.set(key, t), t),
      (err) => (console.warn(`art: ${key} failed to load, keeping the first field`, err), undefined),
    );
    fetching.set(key, p);
  }
  return p;
}

/** The playfield above the wall: the chapter's own once it is in, else the first chapter's. */
export function fieldTexture(key = 'bg_field'): Texture | undefined {
  return textures.get(key) ?? textures.get('bg_field');
}

/** `e`, when given, picks the look of a boss's second state: the tripod without its jar, the
 *  gear king's bare core. */
export function enemyTexture(kind: EnemyKind, e?: { shieldMax?: number; shield?: number; core?: boolean }): Texture | undefined {
  const look = kind === 'tripod' && e?.shieldMax && !e.shield ? 'tripod_bare' : kind === 'gear' && e?.core ? 'gear_core' : kind;
  return textures.get(`enemy_${look}`) ?? textures.get(`enemy_${kind}`);
}

/** The tutorial's pointing glove, fingertip up and to the right (see Tutorial.ts). */
export function handTexture(): Texture | undefined {
  return textures.get('tutorial_hand');
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
