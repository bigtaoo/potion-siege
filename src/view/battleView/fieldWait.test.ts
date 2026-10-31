import { Assets, Container, Texture, type Sprite } from 'pixi.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fieldTexture, loadedField } from '../art';
import { fakeArt, fakeFields } from '../fakeArt';
import { COLORS } from '../ui';
import { FIELD_COLORS, FIELD_WAIT, FieldArt } from './field';

const FADE = 1.6;

function field() {
  const f = new FieldArt();
  const view = new Container();
  view.addChild(f.ground);
  f.build(view);
  const [art, next] = view.children as Sprite[];
  return { f, art, next };
}

/** Makes chapter field `key` come in only when the returned function is called. */
function slow(key: string): (t?: Texture) => Promise<void> {
  let arrive!: (t: Texture) => void;
  const load = Assets.load.bind(Assets);
  vi.spyOn(Assets, 'load').mockImplementation(((url: string) =>
    url.includes(key) ? new Promise<Texture>((r) => (arrive = r)) : load(url)) as never);
  return async (t = new Texture({ source: Texture.WHITE.source })) => {
    arrive(t);
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };
}

describe('a field still on its way', () => {
  beforeAll(async () => {
    await fakeArt();
    await fakeFields(['bg_field']);
  });

  it('never shows another chapter\'s field while it waits, and swaps in its own when it comes', async () => {
    const come = slow('bg_snow');
    const { f, art } = field();
    expect(art.texture).toBe(fieldTexture());
    f.show('bg_snow');
    expect(art.texture).toBe(Texture.WHITE);
    expect([art.alpha, art.tint]).toEqual([0, FIELD_COLORS.bg_snow]);
    f.update(FIELD_WAIT / 2);
    expect(art.alpha).toBe(0);
    await come();
    expect([art.texture, art.alpha, art.tint]).toEqual([loadedField('bg_snow'), 1, 0xffffff]);
  });

  it('fades the chapter\'s colour in after FIELD_WAIT, then fades from it into the art', async () => {
    const come = slow('bg_foundry');
    const { f, art, next } = field();
    f.show('bg_foundry');
    f.update(FIELD_WAIT);
    f.update(0.2);
    expect(art.alpha).toBeCloseTo(0.5);
    f.update(1);
    expect(art.alpha).toBe(1);
    await come();
    expect([art.texture, art.tint]).toEqual([Texture.WHITE, FIELD_COLORS.bg_foundry]);
    expect([next.visible, next.alpha, next.texture]).toEqual([true, 0, loadedField('bg_foundry')]);
    f.update(FADE);
    expect([art.texture, art.tint, next.visible]).toEqual([loadedField('bg_foundry'), 0xffffff, false]);
  });

  it('keeps the colour when the field cannot be had, the plain field colour for an unknown one', async () => {
    const { f, art } = field();
    f.show('bg_nowhere');
    for (let i = 0; i < 4; i++) await Promise.resolve();
    f.update(FIELD_WAIT + 1);
    expect([art.texture, art.alpha, art.tint]).toEqual([Texture.WHITE, 1, COLORS.field]);
  });

  it('keeps the old field over an endless fade until the new one comes', async () => {
    const come = slow('bg_clock');
    const { f, art, next } = field();
    f.show('bg_field');
    f.show('bg_clock', true);
    f.update(FIELD_WAIT + 1);
    expect([art.texture, art.alpha, next.visible]).toEqual([loadedField('bg_field'), 1, false]);
    await come();
    expect([next.visible, next.texture]).toEqual([true, loadedField('bg_clock')]);
  });

  it('drops a field that comes in after a new battle asked for another', async () => {
    const come = slow('bg_rail');
    const { f, art } = field();
    f.show('bg_rail');
    f.reset();
    f.show('bg_field');
    await come();
    expect(art.texture).toBe(loadedField('bg_field'));
  });
});
