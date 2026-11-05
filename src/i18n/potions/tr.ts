// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Işıltı İksiri', metal: 'Cıva İksiri', vine: 'Diken İksiri' },
  role: { light: 'Delici ışın', metal: 'Ağır vuruş', vine: 'Sabitler' },
  rx: { prism: 'Prizma', flare: 'Parlama', magnetize: 'Mıknatıslanma', molten: 'Erime', spores: 'Spor', bramble: 'Buz Dikeni' },
  rxDo: {
    prism: 'Buz ışığı böler: en yakın 3 düşmana ışın',
    flare: 'Isı ve parıltı patlaması: etrafa hasar ve yavaşlatma',
    magnetize: 'Cıva mıknatısa döner: etraftaki herkesi çeker',
    molten: 'Cıva kaynar: ağır yanma',
    spores: 'Sarmaşık etraftaki herkese zehir saçar',
    bramble: 'Donmuş dikenler fışkırır: etraftaki herkes sabitlenir',
  },
  skill: {
    lightDamage: { name: 'Parıltı', desc: 'Işıltı iksirleri +%40 hasar' },
    lightWide: { name: 'Geniş Işın', desc: 'Işık ışınları %40 daha geniş' },
    lightGlare: { name: 'Kamaşma', desc: 'Işınlar geçtiği her şeyi 1 sn %20 yavaşlatır' },
    lightFocus: { name: 'Odak', desc: 'Işınlar hattındaki herkese hedefi kadar sert vurur' },
    lightFire: { name: 'Güneş Ateşi', desc: 'Işınlar ateş gibi yakar' },
    metalDamage: { name: 'Ağır Metal', desc: 'Cıva iksirleri +%40 hasar' },
    metalShrapnel: { name: 'Şarapnel', desc: "Mermiler vuruşun %30'unu çevreye sıçratır" },
    metalCrush: { name: 'Yere Serme', desc: 'Mermiler 0,6 sn yere serebilir (%15); patronlar yavaşlar' },
    metalBreak: { name: 'Zırh Kırıcı', desc: 'Mermiler düşmanı 1,5 sn kırılgan yapar: alınan hasar +%40' },
    metalFire: { name: 'Demirhane', desc: 'Mermiler yanan düşmanlara +%60 hasar' },
    vineDamage: { name: 'Gür Büyüme', desc: 'Diken iksirleri +%40 hasar' },
    vineRoot: { name: 'Derin Kökler', desc: 'Sabitleme %30 daha uzun sürer' },
    vineThorns: { name: 'Dikenler', desc: "Sabitlenen düşmanlar saniyede vuruşun %40'ı kadar kanar" },
    vineSpread: { name: 'Sarmaşık', desc: 'Sarmaşıkla ölenler en yakın düşmanı sabitler' },
    vinePoison: { name: 'Zehirli Diken', desc: 'Sarmaşık vuruşları Asit İksiri gibi zehirler' },
  },
  perk: {
    lightGlarePlus: 'Kamaşma %50 daha güçlü yavaşlatır',
    metalCrushPlus: 'Yere serme %50 daha uzun sürer',
    vineThornsPlus: 'Dikenler +%50 hasar',
  },
};
