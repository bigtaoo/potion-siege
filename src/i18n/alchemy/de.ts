// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Neue Reaktion: {name}! +{n} Kristalle',
  starred: '{name}-Meisterschaft {s}★: Stärke +{p}%',
  power: 'Stärke +{p}%',
  legendBoost: 'Stärkt {name}',
  exits: {
    title: 'Andere Wege',
    lineup: 'Probier diese Aufstellung',
    reacts: '{n} {n|one:Reaktion|other:Reaktionen} untereinander',
    hard: 'Schwer, Kapitel {c}',
    hardDesc: 'Zahlt wie spätere Level',
    tower: 'Der Alchemieturm',
    towerDesc: 'Stockwerke für Kristalle',
  },
  rack: {
    name: 'Braugestell',
    claim: '+{n}',
    got: 'Braugestell: +{n} Kristalle',
    full: 'Voll',
  },
  replayCut: 'Wiederholungen heute: halbe Kristalle',
  talents: {
    open: 'Talente',
    title: '{name}: Talente',
    both: 'Beide Talente von Lv {n}',
    free: 'Jeder Kampf beginnt mit diesen Karten. Jederzeit gratis wechseln.',
  },
  catalyst: {
    title: 'Katalysator: wähle einen',
    held: 'Schon ×{n}',
    volatile: {
      name: 'Flüchtige Salze',
      desc: 'Reaktionen machen für den Rest des Aufstiegs 50 % mehr Schaden.',
    },
    wide: {
      name: 'Wabernder Dampf',
      desc: 'Reaktionen reichen für den Rest des Aufstiegs 30 % weiter.',
    },
    potent: {
      name: 'Konzentrat',
      desc: 'Jeder Trank macht 20 % mehr Schaden.',
    },
    quick: {
      name: 'Quecksilber',
      desc: 'Jeder Trank greift 15 % schneller an.',
    },
    bulwark: {
      name: 'Steinmörtel',
      desc: 'Die Mauer erhält 40 % mehr LP und wird ganz repariert.',
    },
    bounty: {
      name: 'Blattgold',
      desc: 'Jeder Sieg über einen Gegner bringt 2 Gold mehr.',
    },
  },
  rebrew: {
    button: 'Neu brauen',
    count: 'Neu gebraut: {n}',
    essence: 'Essenz: {n}',
    what: 'Gieß alles zurück in den Kessel: Der Feldzug beginnt wieder bei Level 1, die Tränke auf ihrer ersten Stufe. Kodex, Reaktionsmeisterschaft, Talente, Sterne, Kristalle und das halbe Labor bleiben, dazu gibt es Essenz für bleibende Vorteile.',
    go: 'Neu brauen: +{n} Essenz',
    sure: 'Zum Bestätigen erneut tippen',
    locked: 'Schaffe Level {n}, um neu zu brauen',
    done: 'Neu gebraut! +{n} Essenz',
    perks: 'Bleibende Vorteile',
    perk: {
      reaction: 'Reaktionen +{p} %',
      wall: 'Mauer-LP +{p} %',
      gold: 'Startgold +{n}',
      crystals: 'Kristalle +{p} %',
    },
  },
  week: {
    button: 'Woche',
    title: 'Diese Woche',
    rule: 'Turmregel: {name}',
    left: 'Neue Woche in: {n} T.',
    best: 'Bestes Stockwerk der Woche: {n}',
    play: 'Aufsteigen',
    surge: {
      name: 'Woge',
      desc: 'Reaktionen machen 2× Schaden; Gegner haben 30 % mehr LP.',
    },
    focus: {
      name: 'Fokus',
      desc: '{name} macht 4× Schaden.',
    },
    glass: {
      name: 'Glaskanone',
      desc: 'Reaktionen machen 2,5× Schaden; Tränke 20 % weniger.',
    },
    brittle: {
      name: 'Brüchige Mauer',
      desc: 'Reaktionen machen 1,8× Schaden; die Mauer hat 25 % weniger LP.',
    },
    task: {
      kinds: 'Löse {n} verschiedene Reaktionen aus',
      react: 'Löse {n} Reaktionen aus',
      tower: 'Erreiche Stockwerk {n} im Turm',
      challenge: 'Spiele {n} Tagesherausforderungen',
    },
  },
  next: {
    find: 'Noch {n} Reaktionen zu finden: probier neue Paare!',
    week: 'Eine Wochenaufgabe ist fertig',
    tower: 'Turm diese Woche: {name}. Bestes Stockwerk {n}',
    rebrew: 'Feldzug geschafft: neu brauen für {n} Essenz',
    perk: 'Essenz übrig: {n}',
  },
};
