import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameCenterState, PSNative } from './bridge';
import { GAME_CENTER_WAIT_MS, GameCenterAccount } from './gameCenter';

// Game Center through a stub shell: the player boot waits for, the sign-in offer from a tap, and
// what an older shell or a malformed answer reads as.

afterEach(() => vi.useRealTimers());

const PLAYER: GameCenterState = { alias: 'brewer', player: 'T:_abc', canSignIn: false };
const SIGNED_OUT: GameCenterState = { alias: null, player: null, canSignIn: true };

function shell(state: GameCenterState | null, v = 3) {
  let cb: ((s: GameCenterState) => void) | null = null;
  const signIns: number[] = [];
  const native: Partial<PSNative> = { v, gameCenter: () => state, onGameCenter: (c) => void (cb = c), gameCenterSignIn: () => void signIns.push(1) };
  return { native, signIns, push: (s: unknown) => cb?.(s as GameCenterState) };
}

describe('GameCenterAccount', () => {
  it('waits for GameKit\'s first answer, and goes on without it after the wait', async () => {
    vi.useFakeTimers();
    const s = shell(null);
    const gc = new GameCenterAccount(s.native);
    const first = gc.player();
    s.push(PLAYER);
    expect(await first).toBe('T:_abc');
    expect(await gc.player()).toBe('T:_abc');

    const late = new GameCenterAccount(shell(null).native).player();
    vi.advanceTimersByTime(GAME_CENTER_WAIT_MS);
    expect(await late).toBeNull();
  });

  it('answers at once with the state the shell already has, and for a shell without Game Center', async () => {
    expect(await new GameCenterAccount(shell(PLAYER).native).player()).toBe('T:_abc');
    expect(await new GameCenterAccount(shell(SIGNED_OUT).native).player()).toBeNull();
    expect(await new GameCenterAccount(shell(PLAYER, 2).native).player()).toBeNull();
    expect(await new GameCenterAccount(null).player()).toBeNull();
  });

  it('offers the sign-in sheet only while it waits, and tells of every change', () => {
    const s = shell(SIGNED_OUT);
    const gc = new GameCenterAccount(s.native);
    let changes = 0;
    gc.onChange = () => changes++;
    expect([gc.canSignIn(), gc.alias()]).toEqual([true, null]);
    gc.signIn();
    expect(s.signIns).toEqual([1]);
    s.push(SIGNED_OUT);
    expect(changes).toBe(0);
    s.push(PLAYER);
    expect([changes, gc.alias(), gc.canSignIn()]).toEqual([1, 'brewer', false]);
    gc.signIn();
    expect(s.signIns).toEqual([1]);
  });

  it('reads a malformed answer as unknown', async () => {
    const odd = new GameCenterAccount(shell({ alias: '', player: 5, canSignIn: 'yes' } as unknown as GameCenterState).native);
    expect([await odd.player(), odd.alias(), odd.canSignIn()]).toEqual([null, null, false]);
    vi.useFakeTimers();
    const s = shell(null);
    const gc = new GameCenterAccount(s.native);
    const first = gc.player();
    s.push('nonsense');
    vi.advanceTimersByTime(GAME_CENTER_WAIT_MS);
    expect(await first).toBeNull();
  });
});
