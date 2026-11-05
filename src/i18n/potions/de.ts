// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Strahlentrank', metal: 'Quecksilbertrank', vine: 'Dornentrank' },
  role: { light: 'Durchdringender Strahl', metal: 'Schwerer Treffer', vine: 'Fesselt' },
  rx: { prism: 'Prisma', flare: 'Lichtblitz', magnetize: 'Magnetisierung', molten: 'Schmelze', spores: 'Sporen', bramble: 'Frostdornen' },
  rxDo: {
    prism: 'Der Frost bricht das Licht: Strahlen auf die 3 nächsten',
    flare: 'Hitze und grelles Licht: Schaden, bremst alles ringsum',
    magnetize: 'Das Quecksilber wird zum Magneten: zieht alles ringsum heran',
    molten: 'Das Quecksilber kocht über: ein schwerer Brand',
    spores: 'Die Ranke blüht und vergiftet alles ringsum',
    bramble: 'Gefrorene Dornen brechen hervor: hält alles ringsum fest',
  },
  skill: {
    lightDamage: { name: 'Brillanz', desc: 'Strahlentränke +40% Schaden' },
    lightWide: { name: 'Breitstrahl', desc: 'Lichtstrahlen 40% breiter' },
    lightGlare: { name: 'Blendung', desc: 'Strahlen verlangsamen alles, was sie kreuzen, 1 s lang um 20%' },
    lightFocus: { name: 'Fokus', desc: 'Strahlen treffen alles auf ihrer Linie so hart wie ihr Ziel' },
    lightFire: { name: 'Sonnenfeuer', desc: 'Strahlen versengen wie Feuer' },
    metalDamage: { name: 'Schwermetall', desc: 'Quecksilbertränke +40% Schaden' },
    metalShrapnel: { name: 'Splitter', desc: 'Kugeln verspritzen 30% des Treffers ringsum' },
    metalCrush: { name: 'Niederschlag', desc: 'Kugeln können 0,6 s umwerfen (15%); Bosse werden langsamer' },
    metalBreak: { name: 'Rüstungsbruch', desc: 'Kugeln machen Feinde 1,5 s spröde: +40% erlittener Schaden' },
    metalFire: { name: 'Schmiede', desc: 'Kugeln +60% Schaden gegen brennende Feinde' },
    vineDamage: { name: 'Wildwuchs', desc: 'Dornentränke +40% Schaden' },
    vineRoot: { name: 'Tiefe Wurzeln', desc: 'Fesseln halten 30% länger' },
    vineThorns: { name: 'Dornen', desc: 'Gefesselte Feinde bluten pro Sekunde 40% des Treffers' },
    vineSpread: { name: 'Kriechranke', desc: 'Ranken-Abschüsse fesseln den nächsten Feind' },
    vinePoison: { name: 'Giftdornen', desc: 'Rankentreffer vergiften wie Ätztränke' },
  },
  perk: {
    lightGlarePlus: 'Blendung bremst 50% stärker',
    metalCrushPlus: 'Umwerfen hält 50% länger',
    vineThornsPlus: 'Dornen +50% Schaden',
  },
};
