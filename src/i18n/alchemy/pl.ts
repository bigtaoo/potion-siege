// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Nowa reakcja: {name}! +{n} kryształów',
  starred: 'Mistrzostwo {name} {s}★: moc +{p}%',
  power: 'Moc +{p}%',
  legendBoost: 'Wzmacnia {name}',
  exits: {
    title: 'Inne drogi',
    lineup: 'Spróbuj tego składu',
    reacts: 'Reakcje między nimi: {n}',
    hard: 'Trudny, rozdział {c}',
    hardDesc: 'Płaci jak dalsze poziomy',
    tower: 'Wieża alchemii',
    towerDesc: 'Wspinaj się po kryształy',
  },
  rack: {
    name: 'Stojak warzelny',
    claim: '+{n}',
    got: 'Stojak: +{n} kryształów',
    full: 'Pełny',
  },
  replayCut: 'Powtórki dziś: połowa kryształów',
  talents: {
    open: 'Talenty',
    title: '{name}: talenty',
    both: 'Oba talenty z Poz. {n}',
    free: 'Każda bitwa zaczyna się z tymi kartami. Zmiana w każdej chwili, za darmo.',
  },
  catalyst: {
    title: 'Katalizator: wybierz jeden',
    held: 'Masz ×{n}',
    volatile: {
      name: 'Lotne sole',
      desc: 'Reakcje zadają o 50% więcej obrażeń do końca wspinaczki.',
    },
    wide: {
      name: 'Rozległa para',
      desc: 'Reakcje sięgają o 30% dalej do końca wspinaczki.',
    },
    potent: {
      name: 'Koncentrat',
      desc: 'Każda mikstura zadaje o 20% więcej obrażeń.',
    },
    quick: {
      name: 'Żywe srebro',
      desc: 'Każda mikstura atakuje o 15% szybciej.',
    },
    bulwark: {
      name: 'Kamienna zaprawa',
      desc: 'Mur zyskuje 40% więcej PŻ i jest w pełni naprawiony.',
    },
    bounty: {
      name: 'Płatek złota',
      desc: 'Każde pokonanie wroga daje 2 złota więcej.',
    },
  },
  rebrew: {
    button: 'Warz od nowa',
    count: 'Warzenia od nowa: {n}',
    essence: 'Esencja: {n}',
    what: 'Wlej wszystko z powrotem do kotła: kampania zaczyna się od poziomu 1, a mikstury od pierwszego stopnia. Zostają kodeks, mistrzostwo reakcji, talenty, gwiazdy, kryształy i połowa laboratorium, a do tego esencja na stałe premie.',
    go: 'Warz od nowa: +{n} esencji',
    sure: 'Dotknij ponownie, by potwierdzić',
    locked: 'Ukończ poziom {n}, by warzyć od nowa',
    done: 'Uwarzone od nowa! +{n} esencji',
    perks: 'Stałe premie',
    perk: {
      reaction: 'Reakcje +{p}%',
      wall: 'PŻ muru +{p}%',
      gold: 'Złoto na start +{n}',
      crystals: 'Kryształy +{p}%',
    },
  },
  week: {
    button: 'Tydzień',
    title: 'Ten tydzień',
    rule: 'Zasada wieży: {name}',
    left: 'Nowy tydzień za: {n} d.',
    best: 'Najlepsze piętro tygodnia: {n}',
    play: 'Wspinaj się',
    surge: {
      name: 'Fala',
      desc: 'Reakcje zadają 2× obrażenia; wrogowie mają 30% więcej PŻ.',
    },
    focus: {
      name: 'Skupienie',
      desc: '{name} zadaje 4× obrażenia.',
    },
    glass: {
      name: 'Szklane działo',
      desc: 'Reakcje zadają 2,5× obrażenia; mikstury o 20% mniej.',
    },
    brittle: {
      name: 'Kruchy mur',
      desc: 'Reakcje zadają 1,8× obrażenia; mur ma o 25% mniej PŻ.',
    },
    task: {
      kinds: 'Wywołaj różne reakcje: {n}',
      react: 'Wywołaj reakcje: {n}',
      tower: 'Dotrzyj na piętro {n} wieży',
      challenge: 'Zagraj w wyzwanie dnia: {n}',
    },
  },
  next: {
    find: 'Do odkrycia zostało reakcji: {n}. Spróbuj nowych par!',
    week: 'Zadanie tygodnia gotowe do odebrania',
    tower: 'Wieża w tym tygodniu: {name}. Najlepsze piętro {n}',
    rebrew: 'Kampania ukończona: warz od nowa za {n} esencji',
    perk: 'Esencja do wydania: {n}',
  },
};
