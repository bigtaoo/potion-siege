// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Nouvelle réaction : {name} ! +{n} cristaux',
  starred: 'Maîtrise {name} {s}★ : puissance +{p} %',
  power: 'Puissance +{p} %',
  legendBoost: 'Renforce {name}',
  exits: {
    title: 'Autres voies',
    lineup: 'Essaie cette équipe',
    reacts: '{n} {n|one:réaction|other:réactions} entre elles',
    hard: 'Mode difficile, chapitre {c}',
    hardDesc: 'Paie comme des niveaux plus loin',
    tower: 'La tour d\'alchimie',
    towerDesc: 'Grimpe des étages pour des cristaux',
  },
  rack: {
    name: 'Étagère à potions',
    claim: '+{n}',
    got: 'Étagère : +{n} cristaux',
    full: 'Plein',
  },
  replayCut: 'Rejouer ce niveau aujourd\'hui : moitié des cristaux',
  talents: {
    open: 'Aptitudes',
    title: '{name} : talents',
    both: 'Les deux talents du niv. {n}',
    free: 'Chaque combat commence avec ces cartes. Change quand tu veux, gratuit.',
  },
  catalyst: {
    title: 'Catalyseur : choisis-en un',
    held: 'Déjà ×{n}',
    volatile: {
      name: 'Sels volatils',
      desc: 'Les réactions infligent 50 % de dégâts en plus jusqu’à la fin de l’ascension.',
    },
    wide: {
      name: 'Vapeur diffuse',
      desc: 'Les réactions portent 30 % plus loin jusqu’à la fin de l’ascension.',
    },
    potent: {
      name: 'Concentré',
      desc: 'Chaque potion inflige 20 % de dégâts en plus.',
    },
    quick: {
      name: 'Vif-argent',
      desc: 'Chaque potion attaque 15 % plus vite.',
    },
    bulwark: {
      name: 'Mortier de pierre',
      desc: 'Le mur gagne 40 % de PV et est entièrement réparé.',
    },
    bounty: {
      name: 'Feuille d’or',
      desc: 'Chaque ennemi vaincu rapporte 2 pièces d’or de plus.',
    },
  },
  rebrew: {
    button: 'Rebrassage',
    count: 'Rebrassages : {n}',
    essence: 'Essence : {n}',
    what: 'Reverse tout dans le chaudron : la campagne repart du niveau 1 et les potions de leur premier niveau. Tu gardes le codex, la maîtrise des réactions, les talents, les étoiles, les cristaux et la moitié du labo, et gagnes de l’essence pour des bonus permanents.',
    go: 'Rebrasser : +{n} essence',
    sure: 'Touche encore pour confirmer',
    locked: 'Termine le niveau {n} pour rebrasser',
    done: 'Rebrassé ! +{n} essence',
    perks: 'Bonus permanents',
    perk: {
      reaction: 'Réactions +{p} %',
      wall: 'PV du mur +{p} %',
      gold: 'Or de départ +{n}',
      crystals: 'Cristaux +{p} %',
    },
  },
  week: {
    button: 'Semaine',
    title: 'Cette semaine',
    rule: 'Règle de la tour : {name}',
    left: 'Nouvelle semaine dans : {n} j',
    best: 'Meilleur étage de la semaine : {n}',
    play: 'Grimper',
    surge: {
      name: 'Déferlante',
      desc: 'Les réactions infligent 2× dégâts ; les ennemis ont 30 % de PV en plus.',
    },
    focus: {
      name: 'Focalisation',
      desc: '{name} inflige 4× dégâts.',
    },
    glass: {
      name: 'Canon de verre',
      desc: 'Les réactions infligent 2,5× dégâts ; les potions 20 % de moins.',
    },
    brittle: {
      name: 'Mur fragile',
      desc: 'Les réactions infligent 1,8× dégâts ; le mur a 25 % de PV en moins.',
    },
    task: {
      kinds: 'Déclenche {n} réactions différentes',
      react: 'Déclenche {n} réactions',
      tower: 'Atteins l’étage {n} de la tour',
      challenge: 'Joue {n} défis du jour',
    },
  },
  next: {
    find: 'Encore {n} réactions à trouver : essaie de nouvelles paires !',
    week: 'Une tâche de la semaine est prête',
    tower: 'Tour cette semaine : {name}. Meilleur étage {n}',
    rebrew: 'Campagne terminée : rebrasse pour {n} essence',
    perk: 'Essence à dépenser : {n}',
  },
};
