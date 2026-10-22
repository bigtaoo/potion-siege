import { boot } from './app';
import { urlSwitches } from './game/switches';
import { detectLocale, loadLocale } from './i18n';
import { CrazyGamesPlatform } from './platform/crazygames/CrazyGamesPlatform';
import { loadArt } from './view/art';

async function start(): Promise<void> {
  // the first battle's art and the likely language's table come in while the SDK starts (up to
  // its timeout); boot() picks both up where they are. The SDK's own locale and the save can name
  // another language: boot() then fetches that one too.
  void loadArt();
  void loadLocale(detectLocale([urlSwitches(location.search).get('lang'), ...navigator.languages]));
  await boot(await CrazyGamesPlatform.create());
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `Boot failed: ${String(err)}`;
});
