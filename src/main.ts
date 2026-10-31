import { boot } from './app';
import { SafeStore } from './platform/types';
import { WebPlatform } from './platform/web';
import { GUEST } from './save/saveCopies';
import { keepSaves, vaultFor } from './save/saveKeeper';
import { serverBoard } from './board/serverBoard';

async function start(): Promise<void> {
  const platform = new WebPlatform();
  // the browser is the one owner here: our mirror and server copies beside its storage
  const url = vaultFor(false);
  const keeper = await keepSaves(platform.storage, GUEST, { url, doc: document, win: window });
  platform.storage = new SafeStore(keeper);
  platform.leaderboard = serverBoard(url, keeper, platform.name);
  await boot(platform);
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Boot failed: ${String(err)}`;
});
