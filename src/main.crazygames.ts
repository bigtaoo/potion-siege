import { boot } from './app';
import { CrazyGamesPlatform } from './platform/crazygames/CrazyGamesPlatform';

async function start(): Promise<void> {
  await boot(await CrazyGamesPlatform.create());
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Boot failed: ${String(err)}`;
});
