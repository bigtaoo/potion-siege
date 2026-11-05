// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: '新しい反応：{name}！クリスタル+{n}',
  starred: '{name} 熟練度 {s}★：威力+{p}%',
  power: '威力+{p}%',
  legendBoost: '{name}強化',
  exits: {
    title: '別の道',
    lineup: 'この編成を試す',
    reacts: '互いに{n}種の反応',
    hard: 'ハード 第{c}章',
    hardDesc: '先のステージ並みの報酬',
    tower: '錬金の塔',
    towerDesc: '階を登ってクリスタル',
  },
  rack: {
    name: '醸造棚',
    claim: '+{n}',
    got: '醸造棚：クリスタル+{n}',
    full: '満タン',
  },
  replayCut: '本日の再挑戦：クリスタル半分',
  talents: {
    open: '才能',
    title: '{name}：才能',
    both: 'Lv {n}の才能を両方',
    free: '毎戦このカードの効果で開始。いつでも無料で変更。',
  },
  catalyst: {
    title: '触媒：ひとつ選ぶ',
    held: '所持 ×{n}',
    volatile: {
      name: '揮発塩',
      desc: 'この登塔の間、反応ダメージ+50%。',
    },
    wide: {
      name: '拡散蒸気',
      desc: 'この登塔の間、反応範囲+30%。',
    },
    potent: {
      name: '濃縮液',
      desc: '全ポーションのダメージ+20%。',
    },
    quick: {
      name: '水銀',
      desc: '全ポーションの攻撃速度+15%。',
    },
    bulwark: {
      name: '石灰モルタル',
      desc: '城壁の最大HP+40%、全回復。',
    },
    bounty: {
      name: '金箔',
      desc: '敵を倒すごとにゴールド+2。',
    },
  },
  rebrew: {
    button: '再醸造',
    count: '再醸造回数：{n}',
    essence: 'エッセンス：{n}',
    what: 'すべてを大釜に戻す：キャンペーンはステージ1から、ポーションは初期レベルからやり直し。図鑑・反応の熟練・才能・星・クリスタル・研究所の半分は残り、永続ボーナス用のエッセンスを得る。',
    go: '再醸造：エッセンス+{n}',
    sure: 'もう一度タップで確定',
    locked: 'ステージ{n}クリアで再醸造',
    done: '再醸造完了！エッセンス+{n}',
    perks: '永続ボーナス',
    perk: {
      reaction: '反応 +{p}%',
      wall: '城壁HP +{p}%',
      gold: '初期ゴールド +{n}',
      crystals: 'クリスタル +{p}%',
    },
  },
  week: {
    button: '今週',
    title: '今週',
    rule: '塔のルール：{name}',
    left: '次の週まで：{n}日',
    best: '今週の最高階：{n}',
    play: '登る',
    surge: {
      name: '奔流',
      desc: '反応ダメージ×2、敵のHP+30%。',
    },
    focus: {
      name: '集中',
      desc: '{name}のダメージ×4。',
    },
    glass: {
      name: 'ガラスの大砲',
      desc: '反応ダメージ×2.5、ポーションのダメージ-20%。',
    },
    brittle: {
      name: '脆い城壁',
      desc: '反応ダメージ×1.8、城壁HP-25%。',
    },
    task: {
      kinds: '異なる反応を{n}種起こす',
      react: '反応を{n}回起こす',
      tower: '塔の{n}階に到達',
      challenge: 'デイリーチャレンジを{n}回プレイ',
    },
  },
  next: {
    find: '未発見の反応があと{n}種：新しい組み合わせを試そう！',
    week: '今週のタスクを受け取れます',
    tower: '今週の塔：{name}　最高{n}階',
    rebrew: 'キャンペーン制覇：再醸造でエッセンス{n}',
    perk: '使えるエッセンス：{n}',
  },
};
