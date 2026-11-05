// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Tonik Cahaya', metal: 'Tonik Raksa', vine: 'Tonik Duri' },
  role: { light: 'Sinar tembus', metal: 'Pukulan berat', vine: 'Menjerat' },
  rx: { prism: 'Prisma', flare: 'Suar', magnetize: 'Magnetisasi', molten: 'Lebur', spores: 'Spora', bramble: 'Duri Beku' },
  rxDo: {
    prism: 'Es memecah cahaya: sinar ke 3 musuh terdekat',
    flare: 'Ledakan panas dan silau: kerusakan dan memperlambat sekitar',
    magnetize: 'Raksa menjadi magnet: menarik semua di sekitar',
    molten: 'Raksa mendidih: bakar yang dahsyat',
    spores: 'Sulur mekar dan meracuni semua di sekitar',
    bramble: 'Duri beku mencuat: semua di sekitar terjerat',
  },
  skill: {
    lightDamage: { name: 'Gemilang', desc: 'Tonik Cahaya +40% kerusakan' },
    lightWide: { name: 'Sinar Lebar', desc: 'Sinar cahaya 40% lebih lebar' },
    lightGlare: { name: 'Silau', desc: 'Sinar memperlambat semua yang dilewati 20% selama 1d' },
    lightFocus: { name: 'Fokus', desc: 'Sinar mengenai semua di garisnya sekuat targetnya' },
    lightFire: { name: 'Api Surya', desc: 'Sinar membakar sebagai api' },
    metalDamage: { name: 'Logam Berat', desc: 'Tonik Raksa +40% kerusakan' },
    metalShrapnel: { name: 'Serpihan', desc: 'Peluru raksa memercikkan 30% kerusakan ke sekitar' },
    metalCrush: { name: 'Jatuhkan', desc: 'Peluru raksa bisa menjatuhkan 0,6d (15%); bos diperlambat' },
    metalBreak: { name: 'Hancur Zirah', desc: 'Peluru raksa membuat musuh rapuh 1,5d: +40% kerusakan diterima' },
    metalFire: { name: 'Tempa', desc: 'Peluru raksa +60% kerusakan ke musuh terbakar' },
    vineDamage: { name: 'Tumbuh Liar', desc: 'Tonik Duri +40% kerusakan' },
    vineRoot: { name: 'Akar Dalam', desc: 'Jeratan 30% lebih lama' },
    vineThorns: { name: 'Duri', desc: 'Musuh terjerat berdarah 40% kerusakan serangan per detik' },
    vineSpread: { name: 'Sulur Merambat', desc: 'Musuh yang tumbang oleh sulur menjerat musuh terdekat' },
    vinePoison: { name: 'Duri Beracun', desc: 'Serangan sulur meracuni seperti Tonik Korosi' },
  },
  perk: {
    lightGlarePlus: 'Silau memperlambat 50% lebih kuat',
    metalCrushPlus: 'Efek jatuh 50% lebih lama',
    vineThornsPlus: 'Duri +50% kerusakan',
  },
};
