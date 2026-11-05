// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Reaksi baru: {name}! +{n} kristal',
  starred: 'Penguasaan {name} {s}★: kekuatan +{p}%',
  power: 'Kekuatan +{p}%',
  legendBoost: 'Perkuat {name}',
  exits: {
    title: 'Jalan lain',
    lineup: 'Coba tim ini',
    reacts: '{n} reaksi di antara mereka',
    hard: 'Mode sulit, bab {c}',
    hardDesc: 'Bayaran setara tahap lebih jauh',
    tower: 'Menara alkimia',
    towerDesc: 'Naiki lantai demi kristal',
  },
  rack: {
    name: 'Rak seduhan',
    claim: '+{n}',
    got: 'Rak: +{n} kristal',
    full: 'Penuh',
  },
  replayCut: 'Ulang hari ini: setengah kristal',
  talents: {
    open: 'Bakat',
    title: '{name}: bakat',
    both: 'Kedua bakat Lv {n}',
    free: 'Tiap pertempuran mulai dengan kartu ini. Ganti gratis kapan saja.',
  },
  catalyst: {
    title: 'Katalis: pilih satu',
    held: 'Dimiliki ×{n}',
    volatile: {
      name: 'Garam atsiri',
      desc: 'Reaksi memberi 50% lebih banyak damage sampai pendakian selesai.',
    },
    wide: {
      name: 'Uap menyebar',
      desc: 'Jangkauan reaksi 30% lebih luas sampai pendakian selesai.',
    },
    potent: {
      name: 'Konsentrat',
      desc: 'Semua ramuan memberi 20% lebih banyak damage.',
    },
    quick: {
      name: 'Air raksa',
      desc: 'Semua ramuan menyerang 15% lebih cepat.',
    },
    bulwark: {
      name: 'Adukan batu',
      desc: 'Tembok dapat 40% HP lebih dan langsung pulih penuh.',
    },
    bounty: {
      name: 'Daun emas',
      desc: 'Tiap musuh tumbang memberi 2 emas lebih.',
    },
  },
  rebrew: {
    button: 'Seduh ulang',
    count: 'Seduh ulang: {n}',
    essence: 'Esensi: {n}',
    what: 'Tuang semuanya kembali ke kuali: kampanye mulai lagi dari level 1 dan ramuan dari level pertama. Kodeks, penguasaan reaksi, talenta, bintang, kristal, dan setengah lab tetap ada, dan kamu dapat esensi untuk bonus permanen.',
    go: 'Seduh ulang: +{n} esensi',
    sure: 'Ketuk lagi untuk konfirmasi',
    locked: 'Selesaikan level {n} untuk seduh ulang',
    done: 'Diseduh ulang! +{n} esensi',
    perks: 'Bonus permanen',
    perk: {
      reaction: 'Reaksi +{p}%',
      wall: 'HP tembok +{p}%',
      gold: 'Emas awal +{n}',
      crystals: 'Kristal +{p}%',
    },
  },
  week: {
    button: 'Minggu',
    title: 'Minggu ini',
    rule: 'Aturan menara: {name}',
    left: 'Minggu baru dalam: {n} hari',
    best: 'Lantai terbaik minggu ini: {n}',
    play: 'Daki',
    surge: {
      name: 'Gelombang',
      desc: 'Reaksi memberi 2× damage; HP musuh +30%.',
    },
    focus: {
      name: 'Fokus',
      desc: '{name} memberi 4× damage.',
    },
    glass: {
      name: 'Meriam kaca',
      desc: 'Reaksi memberi 2,5× damage; ramuan -20%.',
    },
    brittle: {
      name: 'Tembok rapuh',
      desc: 'Reaksi memberi 1,8× damage; HP tembok -25%.',
    },
    task: {
      kinds: 'Picu {n} reaksi berbeda',
      react: 'Picu {n} reaksi',
      tower: 'Capai lantai {n} di menara',
      challenge: 'Mainkan {n} tantangan harian',
    },
  },
  next: {
    find: 'Masih ada {n} reaksi: coba pasangan baru!',
    week: 'Tugas mingguan siap diklaim',
    tower: 'Menara minggu ini: {name}. Lantai terbaik {n}',
    rebrew: 'Kampanye selesai: seduh ulang untuk {n} esensi',
    perk: 'Esensi tersedia: {n}',
  },
};
