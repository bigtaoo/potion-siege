// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Yeni tepkime: {name}! +{n} kristal',
  starred: '{name} ustalığı {s}★: güç +%{p}',
  power: 'Güç +%{p}',
  legendBoost: '{name} güçlenir',
  exits: {
    title: 'Başka yollar',
    lineup: 'Bu kadroyu dene',
    reacts: 'Aralarında {n} tepkime',
    hard: 'Zor mod, bölüm {c}',
    hardDesc: 'Daha ileri bölümler kadar öder',
    tower: 'Simya kulesi',
    towerDesc: 'Kristal için kat çık',
  },
  rack: {
    name: 'Demleme rafı',
    claim: '+{n}',
    got: 'Raf: +{n} kristal',
    full: 'Dolu',
  },
  replayCut: 'Bugünkü tekrarlar: yarı kristal',
  talents: {
    open: 'Yetenekler',
    title: '{name}: yetenekler',
    both: 'Sv {n} yeteneklerinin ikisi',
    free: 'Her savaş bu kartlarla başlar. İstediğin zaman ücretsiz değiştir.',
  },
  catalyst: {
    title: 'Katalizör: birini seç',
    held: 'Sende ×{n}',
    volatile: {
      name: 'Uçucu tuzlar',
      desc: 'Tırmanışın sonuna dek tepkimeler %50 daha fazla hasar verir.',
    },
    wide: {
      name: 'Yayılan buhar',
      desc: 'Tırmanışın sonuna dek tepkimeler %30 daha geniş alana yayılır.',
    },
    potent: {
      name: 'Konsantre',
      desc: 'Her iksir %20 daha fazla hasar verir.',
    },
    quick: {
      name: 'Cıva',
      desc: 'Her iksir %15 daha hızlı saldırır.',
    },
    bulwark: {
      name: 'Taş harcı',
      desc: 'Sur %40 daha fazla can kazanır ve tamamen onarılır.',
    },
    bounty: {
      name: 'Altın varak',
      desc: 'Her düşman 2 altın daha fazla getirir.',
    },
  },
  rebrew: {
    button: 'Yeniden demle',
    count: 'Yeniden demleme: {n}',
    essence: 'Öz: {n}',
    what: 'Her şeyi kazana geri dök: sefer 1. bölümden, iksirler ilk seviyeden yeniden başlar. Kodeks, tepkime ustalığı, yetenekler, yıldızlar, kristaller ve laboratuvarın yarısı kalır; kalıcı avantajlar için öz kazanırsın.',
    go: 'Yeniden demle: +{n} öz',
    sure: 'Onaylamak için tekrar dokun',
    locked: 'Yeniden demlemek için {n}. bölümü geç',
    done: 'Yeniden demlendi! +{n} öz',
    perks: 'Kalıcı avantajlar',
    perk: {
      reaction: 'Tepkimeler +%{p}',
      wall: 'Sur canı +%{p}',
      gold: 'Başlangıç altını +{n}',
      crystals: 'Kristaller +%{p}',
    },
  },
  week: {
    button: 'Hafta',
    title: 'Bu hafta',
    rule: 'Kule kuralı: {name}',
    left: 'Yeni haftaya: {n} gün',
    best: 'Haftanın en iyi katı: {n}',
    play: 'Tırman',
    surge: {
      name: 'Dalga',
      desc: 'Tepkimeler 2× hasar verir; düşmanların canı %30 fazla.',
    },
    focus: {
      name: 'Odak',
      desc: '{name} 4× hasar verir.',
    },
    glass: {
      name: 'Cam top',
      desc: 'Tepkimeler 2,5× hasar verir; iksirler %20 daha az.',
    },
    brittle: {
      name: 'Kırılgan sur',
      desc: 'Tepkimeler 1,8× hasar verir; surun canı %25 az.',
    },
    task: {
      kinds: '{n} farklı tepkime başlat',
      react: '{n} tepkime başlat',
      tower: 'Kulede {n}. kata ulaş',
      challenge: '{n} günlük meydan okuma oyna',
    },
  },
  next: {
    find: 'Bulunacak {n} tepkime daha var: yeni çiftler dene!',
    week: 'Haftalık görev ödülü hazır',
    tower: 'Bu haftanın kulesi: {name}. En iyi kat {n}',
    rebrew: 'Sefer bitti: {n} öz için yeniden demle',
    perk: 'Harcanacak öz: {n}',
  },
};
