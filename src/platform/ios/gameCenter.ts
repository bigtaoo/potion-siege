import type { GameCenterState, PSNative } from './bridge';

// Game Center through the shell's bridge (bridge v3, docs/ios.md "Game Center"): which player is
// signed in, so the save copies follow them to a new phone or a reinstall (src/save/saveCopies.ts),
// and Apple's sign-in sheet, offered only from a tap. GameKit answers some time after launch: a
// player signed in to Game Center in Settings is signed in silently, usually within a second.
// From D:\standing's GameCenterAccount, without the signed identity.

/** How long boot waits for GameKit's first answer before the save goes on as a guest's (ms). */
export const GAME_CENTER_WAIT_MS = 2000;

export class GameCenterAccount {
  /** Called whenever the player or the sign-in offer changes. */
  onChange: () => void = () => {};
  private state: GameCenterState | null;
  private waiting: (() => void)[] = [];

  constructor(private readonly native: Partial<PSNative> | null) {
    this.state = this.available() ? clean(native?.gameCenter?.call(native)) : null;
    if (!this.available()) return;
    native?.onGameCenter?.call(native, (s) => {
      const next = clean(s);
      const same = next?.player === this.state?.player && next?.alias === this.state?.alias && next?.canSignIn === this.state?.canSignIn;
      this.state = next;
      for (const done of this.waiting.splice(0)) done();
      if (!same) this.onChange();
    });
  }

  /** The signed-in player's id once GameKit has answered, null when signed out, on a shell
   *  without Game Center or when no answer came within `ms`. */
  player(ms = GAME_CENTER_WAIT_MS): Promise<string | null> {
    if (this.state || !this.available()) return Promise.resolve(this.state?.player ?? null);
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiting = this.waiting.filter((w) => w !== done);
        resolve(this.state?.player ?? null);
      };
      const timer = setTimeout(done, ms);
      this.waiting.push(done);
    });
  }

  /** The signed-in player's nickname, null when signed out (or not on the app). */
  alias(): string | null {
    return this.state?.alias ?? null;
  }

  /** Whether a tap can bring up Apple's sign-in sheet now. */
  canSignIn(): boolean {
    return !!this.state?.canSignIn && typeof this.native?.gameCenterSignIn === 'function';
  }

  signIn(): void {
    if (this.canSignIn()) this.native?.gameCenterSignIn?.call(this.native);
  }

  private available(): boolean {
    const n = this.native;
    return !!n && (n.v ?? 0) >= 3 && typeof n.gameCenter === 'function' && typeof n.onGameCenter === 'function';
  }
}

/** The shell's state as the page trusts it: anything malformed reads as unknown. */
function clean(s: unknown): GameCenterState | null {
  if (!s || typeof s !== 'object') return null;
  const { alias, player, canSignIn } = s as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  return { alias: text(alias), player: text(player), canSignIn: canSignIn === true };
}
