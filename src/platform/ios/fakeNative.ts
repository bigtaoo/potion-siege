import type { AdState, GameCenterState, NotifyState, PSNative, StoreState } from './bridge';

// A stand-in for the shell's bridge in a desktop browser (`npm run dev:ios`, then `?native=1`):
// ads that load after a second and play for one, a store that sells the card at once, EEA
// privacy options and a notification sheet that says yes, so the shop strip and the settings button can be laid out without a Mac.
// `?native=owned` starts with the card owned; `?native=gc` signs a Game Center player in after
// half a second (any other mode: signed out, its sheet waiting). Development builds only (main.ios.ts).
export function installFakeNative(mode: string, scope: Record<string, unknown> = window as unknown as Record<string, unknown>): void {
  if (scope.PSNative) return;
  const adCbs: ((s: AdState) => void)[] = [];
  const eventCbs: Parameters<PSNative['onAdEvent']>[0][] = [];
  const storeCbs: ((s: StoreState) => void)[] = [];
  const resultCbs: Parameters<PSNative['onStoreResult']>[0][] = [];
  const notifyCbs: ((s: NotifyState) => void)[] = [];
  let notify: NotifyState = { status: 'unknown' };
  const gcCbs: ((s: GameCenterState) => void)[] = [];
  let gc: GameCenterState | null = null;
  const pushGc = (next: GameCenterState) => {
    gc = next;
    gcCbs.forEach((cb) => cb(next));
  };
  setTimeout(() => pushGc(mode === 'gc' ? { alias: 'FakeBrewer', player: 'T:_fake0001', canSignIn: false } : { alias: null, player: null, canSignIn: true }), 500);
  let ad: AdState = { status: 'pending', rewarded: false, interstitial: false, privacyOptions: true, error: null };
  let store: StoreState = { products: [{ id: 'com.gamestao.potionsiege.adfree', price: 'US$3.99' }], owned: mode === 'owned' ? ['com.gamestao.potionsiege.adfree'] : [], canPay: true };
  const pushAd = (next: Partial<AdState>) => {
    ad = { ...ad, ...next };
    adCbs.forEach((cb) => cb(ad));
  };
  const pushStore = (next: Partial<StoreState>) => {
    store = { ...store, ...next };
    storeCbs.forEach((cb) => cb(store));
  };
  setTimeout(() => pushAd({ status: 'on', rewarded: true, interstitial: true }), 1000);
  const native: PSNative = {
    v: 3,
    saved: {},
    save: () => {},
    openUrl: (url) => void window.open(url, '_blank'),
    languages: [...navigator.languages],
    device: 'fake',
    adState: () => ad,
    onAdState: (cb) => void adCbs.push(cb),
    onAdEvent: (cb) => void eventCbs.push(cb),
    showAd: (kind) => {
      eventCbs.forEach((cb) => cb({ kind, event: 'started', ok: false }));
      pushAd({ [kind]: false });
      setTimeout(() => {
        eventCbs.forEach((cb) => cb({ kind, event: 'done', ok: true }));
        setTimeout(() => pushAd({ [kind]: true }), 1000);
      }, 1000);
    },
    adPrivacy: () => console.info('[fake native] privacy options form'),
    store: () => store,
    onStore: (cb) => void storeCbs.push(cb),
    onStoreResult: (cb) => void resultCbs.push(cb),
    buy: (id) => {
      pushStore({ owned: [id] });
      resultCbs.forEach((cb) => cb({ op: 'buy', outcome: 'owned' }));
    },
    restore: () => resultCbs.forEach((cb) => cb({ op: 'restore', outcome: store.owned.length ? 'owned' : 'none' })),
    notify: () => notify,
    onNotify: (cb) => void notifyCbs.push(cb),
    notifyAsk: () =>
      setTimeout(() => {
        notify = { status: 'on' };
        notifyCbs.forEach((cb) => cb(notify));
      }, 400),
    notifySchedule: (id, at, title, body) => console.info('[fake native] reminder', id, new Date(at).toString(), title, body),
    notifyCancel: (id) => console.info('[fake native] reminder off', id),
    gameCenter: () => gc,
    onGameCenter: (cb) => void gcCbs.push(cb),
    gameCenterSignIn: () => pushGc({ alias: 'FakeBrewer', player: 'T:_fake0001', canSignIn: false }),
  };
  scope.PSNative = native;
}
