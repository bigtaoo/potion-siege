import { describe, expect, it } from 'vitest';
import { WALL_BOTTOM } from '../view/battleView/wall';
import { onField } from './tutorialTap';

describe('onField', () => {
  it('takes the ground and the wall, not the buttons and commander under it', () => {
    expect(onField(540, 600)).toBe(true);
    expect(onField(540, WALL_BOTTOM - 1)).toBe(true);
    expect(onField(540, WALL_BOTTOM + 100)).toBe(false);
    expect(onField(-10, 600)).toBe(false);
    expect(onField(1100, 600)).toBe(false);
  });
});
