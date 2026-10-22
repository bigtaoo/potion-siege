// What boot() (app.ts) sets up beside the game: the page's language, the device the quality
// level starts from, the play statistics' sinks and the anonymous `loaded` beacon.

import type { Application } from 'pixi.js';
import { Analytics, type Sink } from '../analytics/analytics';
import { deviceProps } from '../analytics/perfReport';
import type { PrivacyChoice } from '../analytics/privacy';
import { BeaconSink, ConsoleSink, MemorySink } from '../analytics/sinks';
import { sourceOf } from '../analytics/source';
import { t, type Locale } from '../i18n';
import type { Platform } from '../platform/types';
import type { DeviceInfo } from '../view/quality';
import { gpuName } from '../view/qualityRuntime';
import { BUILD } from './keys';
import { urlSwitches } from './switches';

/** The page follows the language: its title, and its `lang`, which the browser reads to pick
 *  the right glyphs for Chinese, Japanese and Korean text on the canvas. */
export function showLocale(l: Locale): Locale {
  document.documentElement.lang = l;
  document.title = t('title');
  return l;
}

/** 'touch' on a coarse pointer (a phone or tablet), else 'desktop': the beacons' device split. */
export function pointerKind(): 'touch' | 'desktop' {
  try {
    return matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop';
  } catch {
    return 'desktop';
  }
}

/** The anonymous `loaded` count beside the page's inline `open` one (scripts/openBeacon.mjs):
 *  no id, sent whatever the privacy state, split by touch/desktop, new player or not, and source. */
export function loadedBeacon(host: string, analytics: Analytics): void {
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (!url || urlSwitches(location.search).has('autoplay')) return;
  // a local preview of a production build counts nothing, like the open beacon (the iOS app's
  // page is capacitor://localhost, and does count)
  const h = location.hostname;
  if (location.protocol !== 'capacitor:' && (h === 'localhost' || h === '[::1]' || h.startsWith('127.'))) return;
  try {
    const n = analytics.sessions === 1 ? 1 : 0;
    const q = `h=${encodeURIComponent(host)}&b=${encodeURIComponent(BUILD)}&s=loaded_${pointerKind()}&ms=${Math.round(performance.now())}&n=${n}&r=${encodeURIComponent(analytics.source)}`;
    void fetch(`${url.replace(/\/e$/, '')}/b?${q}`, { mode: 'no-cors', keepalive: true }).catch(() => {});
  } catch {
    // a count lost, never the game
  }
}

/** What the quality level starts from; a touch screen with a phone's browser counts as a phone. */
export function device(app: Application): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let gpu = '';
  try {
    gpu = gpuName(app.renderer);
  } catch {
    // no WebGL details: judged by the rest
  }
  return {
    mobile: navigator.maxTouchPoints > 0 && /mobi|android|iphone|ipad/i.test(navigator.userAgent),
    cores: nav.hardwareConcurrency || 0,
    memoryGB: nav.deviceMemory || 0,
    gpu,
    dpr: window.devicePixelRatio || 1,
  };
}

export function safeDevice(app: Application): ReturnType<typeof deviceProps> {
  try {
    return deviceProps(app.renderer);
  } catch {
    return {};
  }
}

/** Console with `?track`, an in-memory log in dev, and the collector when VITE_ANALYTICS_URL is set. */
export function createAnalytics(platform: Platform, params: URLSearchParams, privacy: PrivacyChoice): Analytics {
  const sinks: Sink[] = [];
  if (import.meta.env.DEV) sinks.push(new MemorySink());
  if (params.has('track')) sinks.push(new ConsoleSink());
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (url && !params.has('autoplay')) sinks.push(new BeaconSink(url));
  // a first visit records where the player came from (analytics/source.ts)
  return new Analytics(platform.storage, sinks, BUILD, platform.name, undefined, () => sourceOf(location.search, document.referrer, location.hostname, __PS_DEFAULT_SRC__), privacy.sharing());
}
