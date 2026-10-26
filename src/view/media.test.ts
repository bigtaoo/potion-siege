import { describe, expect, it } from 'vitest';
import { isPhone, wantsUpright } from './media';

describe('isPhone', () => {
  it('counts touch screens narrow on their short side as phones, either way round', () => {
    expect(isPhone(true, 390, 844)).toBe(true); // iPhone 14
    expect(isPhone(true, 932, 430)).toBe(true); // iPhone Pro Max sideways
    expect(isPhone(true, 412, 915)).toBe(true); // Android phone
  });

  it('leaves tablets, desktops and unknown screens free to play either way', () => {
    expect(isPhone(true, 744, 1133)).toBe(false); // iPad mini
    expect(isPhone(true, 1366, 1024)).toBe(false); // iPad Pro
    expect(isPhone(true, 600, 960)).toBe(false); // small Android tablet
    expect(isPhone(false, 390, 844)).toBe(false); // a narrow desktop window
    expect(isPhone(true, 0, 0)).toBe(false);
  });
});

describe('wantsUpright', () => {
  it('asks only a phone held sideways to turn upright', () => {
    expect(wantsUpright(844, 390, true)).toBe(true);
    expect(wantsUpright(390, 844, true)).toBe(false);
    expect(wantsUpright(1366, 1024, false)).toBe(false);
  });
});
