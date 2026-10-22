import type { Platform } from '../platform/types';

/**
 * The languages the host lists (CrazyGames: the portal's locale alone, iOS: the phone's) and the
 * browser's own, at most four each, for `session_start` beside the `lang` picked: they show
 * whether a portal set to English hides a table the player's browser would have picked.
 */
export function languageProps(platform: Pick<Platform, 'languages'>, browser: readonly string[] | undefined): { langs: string; navLangs: string } {
  const list = (langs: readonly string[]) => [...new Set(langs)].slice(0, 4).join(',').slice(0, 64);
  let host: string[] = [];
  try {
    host = platform.languages();
  } catch {
    // no list: left empty
  }
  return { langs: list(host), navLangs: list(browser ?? []) };
}
