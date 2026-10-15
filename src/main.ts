import { boot } from './app';
import { WebPlatform } from './platform/web';

boot(new WebPlatform()).catch((err) => {
  console.error(err);
  document.body.textContent = `Boot failed: ${String(err)}`;
});
