// The URL switches (README "URL switches"): ?autoplay, ?speed, ?ads=fake, ?track, ?quality and
// ?lang. A release build (web, CrazyGames, iOS) reads only ?lang, which changes nothing but the
// words: the others let anyone on the live page farm crystals at ?speed, get free rewarded ads
// or run the bot into their save. Same rule as D:\standing's 5958f85.

/** Switches a release build still reads. */
const RELEASE: readonly string[] = ['lang'];

/** The page's switches: all of them in a dev build, only RELEASE's in a release. */
export function urlSwitches(search: string, dev: boolean = import.meta.env.DEV): URLSearchParams {
  const all = new URLSearchParams(search);
  if (dev) return all;
  const kept = new URLSearchParams();
  for (const [k, v] of all) if (RELEASE.includes(k)) kept.append(k, v);
  return kept;
}
