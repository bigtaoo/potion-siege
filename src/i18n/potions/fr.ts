// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Élixir radieux', metal: 'Élixir de vif-argent', vine: 'Élixir de ronces' },
  role: { light: 'Rayon perçant', metal: 'Frappe lourde', vine: 'Enracine' },
  rx: { prism: 'Prisme', flare: 'Embrasement', magnetize: 'Aimantation', molten: 'Fusion', spores: 'Nuée de spores', bramble: 'Ronces de givre' },
  rxDo: {
    prism: 'Le givre divise la lumière : rayons sur les 3 plus proches',
    flare: 'Éclat de chaleur et de lumière : dégâts et ralentit tout autour',
    magnetize: 'Le vif-argent devient aimant : attire tout autour',
    molten: 'Le vif-argent entre en ébullition : forte brûlure',
    spores: 'La ronce fleurit en poison sur tout ce qui est proche',
    bramble: 'Des ronces gelées jaillissent : tout autour est entravé',
  },
  skill: {
    lightDamage: { name: 'Splendeur', desc: 'Élixirs radieux +40% de dégâts' },
    lightWide: { name: 'Rayon large', desc: 'Rayons de lumière 40% plus larges' },
    lightGlare: { name: 'Aveuglement', desc: 'Les rayons ralentissent de 20% pendant 1s tout ce qu’ils traversent' },
    lightFocus: { name: 'Focalisation', desc: 'Les rayons frappent tout sur leur ligne aussi fort que leur cible' },
    lightFire: { name: 'Feu solaire', desc: 'Les rayons brûlent comme le feu' },
    metalDamage: { name: 'Métal lourd', desc: 'Élixirs de vif-argent +40% de dégâts' },
    metalShrapnel: { name: 'Éclats', desc: 'Les balles projettent 30% du coup autour' },
    metalCrush: { name: 'Renversement', desc: 'Les balles peuvent renverser 0,6s (15%) ; les boss sont ralentis' },
    metalBreak: { name: 'Brise-armure', desc: 'Les balles fragilisent les ennemis 1,5s : +40% de dégâts subis' },
    metalFire: { name: 'Fonderie', desc: 'Balles +60% de dégâts sur les ennemis en feu' },
    vineDamage: { name: 'Prolifération', desc: 'Élixirs de ronces +40% de dégâts' },
    vineRoot: { name: 'Racines profondes', desc: 'Les enracinements durent 30% plus longtemps' },
    vineThorns: { name: 'Épines', desc: 'Les ennemis enracinés saignent 40% du coup par seconde' },
    vineSpread: { name: 'Liane rampante', desc: 'Une élimination à la ronce enracine l’ennemi le plus proche' },
    vinePoison: { name: 'Épines toxiques', desc: 'Les coups de ronce empoisonnent comme les élixirs corrosifs' },
  },
  perk: {
    lightGlarePlus: 'Aveuglement ralentit 50% plus fort',
    metalCrushPlus: 'Les renversements durent 50% plus longtemps',
    vineThornsPlus: 'Épines +50% de dégâts',
  },
};
