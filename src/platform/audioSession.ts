/** Safari 16.4+ (and WKWebView, iOS 17): game sound mixes with the player's own music instead of
 *  pausing it, and obeys the silent switch. Other browsers have no such switch and need none; the
 *  iOS shell sets the same AVAudioSession category for older systems. */
export function shareSpeaker(nav: unknown = globalThis.navigator): void {
  const session = (nav as { audioSession?: { type: string } } | undefined)?.audioSession;
  if (!session) return;
  try {
    session.type = 'ambient';
  } catch {
    /* a session that refuses the type keeps the browser's own */
  }
}
