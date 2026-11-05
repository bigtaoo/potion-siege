// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Tonico Radioso', metal: 'Tonico di Mercurio', vine: 'Tonico di Rovi' },
  role: { light: 'Raggio perforante', metal: 'Colpo pesante', vine: 'Immobilizza' },
  rx: { prism: 'Prisma', flare: 'Bagliore', magnetize: 'Magnetismo', molten: 'Fusione', spores: 'Spore', bramble: 'Rovi di gelo' },
  rxDo: {
    prism: 'Il gelo scompone la luce: raggi sui 3 più vicini',
    flare: 'Un lampo di calore e luce: danni e rallenta tutto intorno',
    magnetize: 'Il mercurio diventa magnete: attira tutto intorno',
    molten: 'Il mercurio ribolle: un’ustione pesante',
    spores: 'Il rovo fiorisce veleno su tutto ciò che è vicino',
    bramble: 'Esplodono rovi gelati: tutto intorno resta bloccato',
  },
  skill: {
    lightDamage: { name: 'Splendore', desc: 'Tonici radiosi +40% danni' },
    lightWide: { name: 'Raggio Ampio', desc: 'Raggi di luce più larghi del 40%' },
    lightGlare: { name: 'Abbaglio', desc: 'I raggi rallentano del 20% per 1s tutto ciò che attraversano' },
    lightFocus: { name: 'Messa a Fuoco', desc: 'I raggi colpiscono tutto sulla loro linea forte quanto il bersaglio' },
    lightFire: { name: 'Fuoco Solare', desc: 'I raggi bruciano come il fuoco' },
    metalDamage: { name: 'Metallo Pesante', desc: 'Tonici di mercurio +40% danni' },
    metalShrapnel: { name: 'Schegge', desc: 'I proiettili spargono il 30% del colpo intorno' },
    metalCrush: { name: 'Atterramento', desc: 'I proiettili possono atterrare per 0,6s (15%); i boss rallentano' },
    metalBreak: { name: 'Spezzacorazza', desc: 'I proiettili rendono fragili i nemici per 1,5s: +40% danni subiti' },
    metalFire: { name: 'Forgia', desc: 'Proiettili +60% danni sui nemici in fiamme' },
    vineDamage: { name: 'Rigoglio', desc: 'Tonici di rovi +40% danni' },
    vineRoot: { name: 'Radici Profonde', desc: 'Le immobilizzazioni durano il 30% in più' },
    vineThorns: { name: 'Spine', desc: 'I nemici immobilizzati sanguinano il 40% del colpo al secondo' },
    vineSpread: { name: 'Rampicante', desc: 'Le uccisioni del rovo immobilizzano il nemico più vicino' },
    vinePoison: { name: 'Spine Tossiche', desc: 'I colpi del rovo avvelenano come il corrosivo' },
  },
  perk: {
    lightGlarePlus: 'Abbaglio rallenta il 50% in più',
    metalCrushPlus: 'Gli atterramenti durano il 50% in più',
    vineThornsPlus: 'Spine +50% danni',
  },
};
