// The inline `open_*` load checkpoint both builds put in index.html's <head> (vite.config.js for
// the web, vite.crazygames.config.js for the portal), ahead of anything else that downloads: a
// tick later would miss every launch given up while the bundle or the SDK loads. The game sends
// `loaded_*` once its first battle frame is up (app.ts loadedBeacon), with the same desktop/touch
// test, so loaded / opened is the share of launches that got past loading.
//
// Both go to the collector's GET /b (scripts/collector.mjs) with no id, whatever the privacy
// state. Besides the device kind they carry `n` (1 when this browser has no player record yet:
// a new player's launch) and `r`, the acquisition source: the one in the player record, or for a
// new player the same rule as src/analytics/source.ts sourceOf, written out in plain ES5 here
// (source.test.ts runs both on the same cases). A local preview counts nothing; the iOS app, whose
// page is capacitor://localhost, does count.

/** The inline script for `host` ('crazygames', 'web' or 'ios'); `defaultSrc` is the build's own source tag. */
export function openBeacon(collector, build, host = 'crazygames', defaultSrc = '') {
  const base = `${collector}/b?h=${host}&b=${encodeURIComponent(build)}&s=open_`;
  return (
    '<script>(function(){try{' +
    "var h=location.hostname;if(location.protocol!=='capacitor:'&&(h==='localhost'||h==='[::1]'||h.indexOf('127.')===0))return;" +
    "var t=matchMedia('(pointer: coarse)').matches?'touch':'desktop';" +
    "var c=function(s){return String(s==null?'':s).toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,40)};" +
    "var n='1',r='';" +
    "try{var p=JSON.parse(localStorage.getItem('mb.player')||'null');if(p&&typeof p.id==='string'&&typeof p.firstDay==='number'){n='0';r=typeof p.src==='string'&&p.src?p.src:'unknown'}}catch(e){}" +
    `if(!r){var q=new URLSearchParams(location.search);r=c(q.get('src'))||c(q.get('utm_source'))||c(${JSON.stringify(defaultSrc)});` +
    "if(!r){var f='';try{f=new URL(document.referrer).hostname.toLowerCase().replace(/^www\\./,'')}catch(e){}" +
    "r=f&&f!==h.toLowerCase().replace(/^www\\./,'')?(c(f)||'direct'):'direct'}}" +
    `fetch(${JSON.stringify(base)}+t+'&n='+n+'&r='+encodeURIComponent(c(r)||'unknown'),{mode:'no-cors',keepalive:true}).catch(function(){})` +
    '}catch(e){}})()</script>'
  );
}
