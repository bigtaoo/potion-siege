// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Nuova reazione: {name}! +{n} cristalli',
  starred: 'Maestria {name} {s}★: potenza +{p}%',
  power: 'Potenza +{p}%',
  legendBoost: 'Potenzia {name}',
  exits: {
    title: 'Altre strade',
    lineup: 'Prova questa squadra',
    reacts: '{n} {n|one:reazione|other:reazioni} tra loro',
    hard: 'Difficile, capitolo {c}',
    hardDesc: 'Paga come livelli più avanti',
    tower: 'La torre alchemica',
    towerDesc: 'Sali piani per cristalli',
  },
  rack: {
    name: 'Scaffale delle pozioni',
    claim: '+{n}',
    got: 'Scaffale: +{n} cristalli',
    full: 'Pieno',
  },
  replayCut: 'Rigiocare oggi: metà cristalli',
  talents: {
    open: 'Talenti',
    title: '{name}: talenti',
    both: 'Entrambi i talenti Lv {n}',
    free: 'Ogni battaglia inizia con queste carte. Cambia gratis quando vuoi.',
  },
  catalyst: {
    title: 'Catalizzatore: scegline uno',
    held: 'Già ×{n}',
    volatile: {
      name: 'Sali volatili',
      desc: 'Le reazioni fanno il 50% di danni in più per il resto della scalata.',
    },
    wide: {
      name: 'Vapore diffuso',
      desc: 'Le reazioni arrivano il 30% più lontano per il resto della scalata.',
    },
    potent: {
      name: 'Concentrato',
      desc: 'Ogni pozione fa il 20% di danni in più.',
    },
    quick: {
      name: 'Argento vivo',
      desc: 'Ogni pozione attacca il 15% più veloce.',
    },
    bulwark: {
      name: 'Malta di pietra',
      desc: 'Il muro ottiene il 40% di PV in più e viene riparato del tutto.',
    },
    bounty: {
      name: 'Foglia d’oro',
      desc: 'Ogni nemico abbattuto dà 2 monete d’oro in più.',
    },
  },
  rebrew: {
    button: 'Ridistilla',
    count: 'Ridistillazioni: {n}',
    essence: 'Essenza: {n}',
    what: 'Riversa tutto nel calderone: la campagna riparte dal livello 1 e le pozioni dal primo livello. Tieni il codice, la maestria delle reazioni, i talenti, le stelle, i cristalli e metà del laboratorio, e ottieni essenza per bonus permanenti.',
    go: 'Ridistilla: +{n} essenza',
    sure: 'Tocca di nuovo per confermare',
    locked: 'Supera il livello {n} per ridistillare',
    done: 'Ridistillato! +{n} essenza',
    perks: 'Bonus permanenti',
    perk: {
      reaction: 'Reazioni +{p}%',
      wall: 'PV del muro +{p}%',
      gold: 'Oro iniziale +{n}',
      crystals: 'Cristalli +{p}%',
    },
  },
  week: {
    button: 'Settimana',
    title: 'Questa settimana',
    rule: 'Regola della torre: {name}',
    left: 'Nuova settimana tra: {n} g',
    best: 'Piano migliore della settimana: {n}',
    play: 'Scala',
    surge: {
      name: 'Ondata',
      desc: 'Le reazioni fanno 2× danni; i nemici hanno il 30% di PV in più.',
    },
    focus: {
      name: 'Focus',
      desc: '{name} fa 4× danni.',
    },
    glass: {
      name: 'Cannone di vetro',
      desc: 'Le reazioni fanno 2,5× danni; le pozioni il 20% in meno.',
    },
    brittle: {
      name: 'Muro fragile',
      desc: 'Le reazioni fanno 1,8× danni; il muro ha il 25% di PV in meno.',
    },
    task: {
      kinds: 'Innesca {n} reazioni diverse',
      react: 'Innesca {n} reazioni',
      tower: 'Raggiungi il piano {n} della torre',
      challenge: 'Gioca {n} sfide del giorno',
    },
  },
  next: {
    find: 'Ancora {n} reazioni da scoprire: prova nuove coppie!',
    week: 'Un compito settimanale è pronto',
    tower: 'Torre questa settimana: {name}. Piano migliore {n}',
    rebrew: 'Campagna finita: ridistilla per {n} essenza',
    perk: 'Essenza da spendere: {n}',
  },
};
