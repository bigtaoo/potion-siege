// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: '光芒药剂', metal: '水银药剂', vine: '荆棘药剂' },
  role: { light: '穿透光束', metal: '重击', vine: '定身' },
  rx: { prism: '棱镜', flare: '耀斑', magnetize: '磁化', molten: '熔融', spores: '孢子', bramble: '霜棘' },
  rxDo: {
    prism: '冰霜折射光芒：再射向最近的 3 个敌人',
    flare: '热浪与强光爆发：周围伤害并减速',
    magnetize: '水银化作磁铁：把周围敌人吸过来',
    molten: '水银沸腾：猛烈灼烧',
    spores: '藤蔓开出毒花：周围全部中毒',
    bramble: '冰冻的荆棘迸出：周围敌人全被缠住',
  },
  skill: {
    lightDamage: { name: '璀璨', desc: '光芒药剂伤害 +40%' },
    lightWide: { name: '宽光束', desc: '光束宽度 +40%' },
    lightGlare: { name: '强光', desc: '光束扫过的敌人减速 20%，持续 1 秒' },
    lightFocus: { name: '聚焦', desc: '光束上的所有敌人都受全额伤害' },
    lightFire: { name: '日炎', desc: '光束带火焰灼烧' },
    metalDamage: { name: '重金属', desc: '水银药剂伤害 +40%' },
    metalShrapnel: { name: '破片', desc: '弹丸向周围溅射 30% 伤害' },
    metalCrush: { name: '击倒', desc: '弹丸有 15% 几率击倒 0.6 秒；首领改为减速' },
    metalBreak: { name: '破甲', desc: '弹丸让敌人脆弱 1.5 秒：受到伤害 +40%' },
    metalFire: { name: '锻炉', desc: '弹丸对燃烧中的敌人伤害 +60%' },
    vineDamage: { name: '疯长', desc: '荆棘药剂伤害 +40%' },
    vineRoot: { name: '深根', desc: '定身时间 +30%' },
    vineThorns: { name: '尖刺', desc: '被定身的敌人每秒流失命中伤害的 40%' },
    vineSpread: { name: '蔓生', desc: '荆棘击杀后缠住最近的敌人' },
    vinePoison: { name: '毒棘', desc: '荆棘命中像腐蚀药剂一样施毒' },
  },
  perk: {
    lightGlarePlus: '强光减速效果 +50%',
    metalCrushPlus: '击倒时间 +50%',
    vineThornsPlus: '尖刺伤害 +50%',
  },
};
