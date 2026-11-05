// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: '閃光ポーション', metal: '水銀ポーション', vine: '茨ポーション' },
  role: { light: '貫通ビーム', metal: '重撃', vine: '拘束' },
  rx: { prism: 'プリズム', flare: 'フレア', magnetize: '磁化', molten: '溶融', spores: '胞子', bramble: '霜の茨' },
  rxDo: {
    prism: '霜が光を分ける：近くの3体にビーム',
    flare: '熱と閃光が炸裂：周囲にダメージと減速',
    magnetize: '水銀が磁石に：周囲の敵を引き寄せる',
    molten: '水銀が沸き立つ：激しく燃やす',
    spores: 'ツタが毒の花を咲かせ、周囲すべてを毒に',
    bramble: '凍った茨が飛び出す：周囲の敵をすべて拘束',
  },
  skill: {
    lightDamage: { name: '輝き', desc: '閃光ポーションのダメージ +40%' },
    lightWide: { name: '広域ビーム', desc: 'ビームの幅 +40%' },
    lightGlare: { name: 'まぶしさ', desc: 'ビームが通った敵を1秒間20%減速' },
    lightFocus: { name: '集光', desc: 'ビーム上の敵すべてに目標と同じダメージ' },
    lightFire: { name: '太陽の炎', desc: 'ビームが火炎として焼く' },
    metalDamage: { name: '重金属', desc: '水銀ポーションのダメージ +40%' },
    metalShrapnel: { name: '破片', desc: '弾丸が命中ダメージの30%を周囲に飛び散らす' },
    metalCrush: { name: 'ノックダウン', desc: '弾丸が15%の確率で0.6秒転倒させる。ボスは減速' },
    metalBreak: { name: '鎧砕き', desc: '弾丸で敵を1.5秒もろくする：被ダメージ +40%' },
    metalFire: { name: '鍛冶炉', desc: '燃えている敵への弾丸ダメージ +60%' },
    vineDamage: { name: '繁茂', desc: '茨ポーションのダメージ +40%' },
    vineRoot: { name: '深い根', desc: '拘束時間 +30%' },
    vineThorns: { name: 'トゲ', desc: '拘束中の敵が毎秒、命中ダメージの40%を失う' },
    vineSpread: { name: 'つる伸ばし', desc: '茨で倒すと最も近い敵を拘束' },
    vinePoison: { name: '毒茨', desc: '茨の命中で腐食ポーションのように毒を与える' },
  },
  perk: {
    lightGlarePlus: '「まぶしさ」減速効果 +50%',
    metalCrushPlus: 'ノックダウン時間 +50%',
    vineThornsPlus: '「トゲ」ダメージ +50%',
  },
};
