// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: '新反应：{name}！+{n} 水晶',
  starred: '{name} 熟练度 {s}★：威力 +{p}%',
  power: '威力 +{p}%',
  legendBoost: '强化{name}',
  exits: {
    title: '换条路走',
    lineup: '试试这个阵容',
    reacts: '彼此能引发 {n} 种反应',
    hard: '困难模式 第 {c} 章',
    hardDesc: '按更后面的关卡发水晶',
    tower: '炼金塔',
    towerDesc: '爬楼层赚水晶',
  },
  rack: {
    name: '酿造架',
    claim: '+{n}',
    got: '酿造架：+{n} 水晶',
    full: '已满',
  },
  replayCut: '今天重打此关：水晶减半',
  talents: {
    open: '天赋',
    title: '{name}：天赋',
    both: '两个 Lv {n} 天赋都要',
    free: '每场战斗开局即带这些卡牌效果。随时免费切换。',
  },
  catalyst: {
    title: '催化剂：选一个',
    held: '已有 ×{n}',
    volatile: {
      name: '挥发盐',
      desc: '本次爬塔中，反应伤害 +50%。',
    },
    wide: {
      name: '弥散蒸汽',
      desc: '本次爬塔中，反应范围扩大 30%。',
    },
    potent: {
      name: '浓缩液',
      desc: '所有药水伤害 +20%。',
    },
    quick: {
      name: '水银',
      desc: '所有药水攻速 +15%。',
    },
    bulwark: {
      name: '石灰浆',
      desc: '城墙生命上限 +40%，并立即修满。',
    },
    bounty: {
      name: '金箔',
      desc: '每次击杀多得 2 金币。',
    },
  },
  rebrew: {
    button: '转生',
    count: '转生次数：{n}',
    essence: '精华：{n}',
    what: '把一切倒回坩埚：战役从第 1 关重新开始，药水回到初始等级。图鉴、反应精通、天赋、星星、水晶和一半实验室保留，并获得精华，用来购买永久加成。',
    go: '转生：+{n} 精华',
    sure: '再点一次确认转生',
    locked: '通关第 {n} 关后可转生',
    done: '转生成功！+{n} 精华',
    perks: '永久加成',
    perk: {
      reaction: '反应伤害 +{p}%',
      wall: '城墙生命 +{p}%',
      gold: '初始金币 +{n}',
      crystals: '水晶收益 +{p}%',
    },
  },
  week: {
    button: '本周',
    title: '本周',
    rule: '本周爬塔规则：{name}',
    left: '距下周：{n} 天',
    best: '本周最高层：{n}',
    play: '去爬塔',
    surge: {
      name: '激涌',
      desc: '反应伤害 ×2；敌人生命 +30%。',
    },
    focus: {
      name: '专注',
      desc: '{name}伤害 ×4。',
    },
    glass: {
      name: '玻璃大炮',
      desc: '反应伤害 ×2.5；药水伤害 -20%。',
    },
    brittle: {
      name: '脆墙',
      desc: '反应伤害 ×1.8；城墙生命 -25%。',
    },
    task: {
      kinds: '触发 {n} 种不同反应',
      react: '触发 {n} 次反应',
      tower: '爬塔到达第 {n} 层',
      challenge: '完成 {n} 次每日挑战',
    },
  },
  next: {
    find: '还有 {n} 种反应未发现：试试新的组合！',
    week: '有本周任务可以领取了',
    tower: '本周爬塔：{name}，最高 {n} 层',
    rebrew: '战役已通关：转生可得 {n} 精华',
    perk: '有 {n} 精华可用',
  },
};
