// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Promienny Eliksir', metal: 'Rtęciowy Eliksir', vine: 'Cierniowy Eliksir' },
  role: { light: 'Przebijający promień', metal: 'Ciężki cios', vine: 'Unieruchamia' },
  rx: { prism: 'Pryzmat', flare: 'Rozbłysk', magnetize: 'Magnetyzm', molten: 'Wrzenie', spores: 'Zarodniki', bramble: 'Mroźne ciernie' },
  rxDo: {
    prism: 'Szron rozszczepia światło: promienie w 3 najbliższych',
    flare: 'Wybuch żaru i blasku: obrażenia i spowolnienie wokół',
    magnetize: 'Rtęć staje się magnesem: przyciąga wszystko wokół',
    molten: 'Rtęć wrze: mocny żar',
    spores: 'Pnącze kwitnie trucizną na wszystko wokół',
    bramble: 'Wyrastają zamarznięte ciernie: wszystko wokół unieruchomione',
  },
  skill: {
    lightDamage: { name: 'Blask', desc: 'Promienne eliksiry +40% obrażeń' },
    lightWide: { name: 'Szeroki Promień', desc: 'Promienie światła o 40% szersze' },
    lightGlare: { name: 'Oślepienie', desc: 'Promienie spowalniają wszystko na drodze o 20% na 1 s' },
    lightFocus: { name: 'Skupienie', desc: 'Promienie trafiają wszystko na linii tak mocno jak cel' },
    lightFire: { name: 'Słoneczny Ogień', desc: 'Promienie palą jak ogień' },
    metalDamage: { name: 'Ciężki Metal', desc: 'Rtęciowe eliksiry +40% obrażeń' },
    metalShrapnel: { name: 'Odłamki', desc: 'Kule rozpryskują 30% trafienia wokół' },
    metalCrush: { name: 'Powalenie', desc: 'Kule mogą powalić na 0,6 s (15%); bossów spowalniają' },
    metalBreak: { name: 'Łamacz Pancerza', desc: 'Kule osłabiają wrogów na 1,5 s: +40% otrzymywanych obrażeń' },
    metalFire: { name: 'Kuźnia', desc: 'Kule +60% obrażeń przeciw płonącym wrogom' },
    vineDamage: { name: 'Bujny Wzrost', desc: 'Cierniowe eliksiry +40% obrażeń' },
    vineRoot: { name: 'Głębokie Korzenie', desc: 'Unieruchomienie trwa o 30% dłużej' },
    vineThorns: { name: 'Ciernie', desc: 'Unieruchomieni wrogowie krwawią 40% trafienia na sekundę' },
    vineSpread: { name: 'Pełzacz', desc: 'Zabójstwa pnączem unieruchamiają najbliższego wroga' },
    vinePoison: { name: 'Trujące Ciernie', desc: 'Trafienia pnączem trują jak żrący eliksir' },
  },
  perk: {
    lightGlarePlus: 'Oślepienie spowalnia o 50% mocniej',
    metalCrushPlus: 'Powalenia trwają o 50% dłużej',
    vineThornsPlus: 'Ciernie +50% obrażeń',
  },
};
