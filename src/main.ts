import { boot } from './app';
import { SafeStore } from './platform/types';
import { WebPlatform } from './platform/web';
import { GUEST } from './save/saveCopies';
import { keepSaves, vaultFor } from './save/saveKeeper';

async function start(): Promise<void> {
  const platform = new WebPlatform();
  // the browser is the one owner here: our mirror and server copies beside its storage
  platform.storage = new SafeStore(await keepSaves(platform.storage, GUEST, { url: vaultFor(false), doc: document, win: window }));
  await boot(platform);
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Boot failed: ${String(err)}`;
});
