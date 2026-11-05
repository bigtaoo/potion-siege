// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: '새 반응: {name}! 크리스탈 +{n}',
  starred: '{name} 숙련도 {s}★: 위력 +{p}%',
  power: '위력 +{p}%',
  legendBoost: '{name} 강화',
  exits: {
    title: '다른 길',
    lineup: '이 조합을 써 보세요',
    reacts: '서로 반응 {n}종',
    hard: '하드 모드 {c}장',
    hardDesc: '더 뒤 스테이지만큼 보상',
    tower: '연금술 탑',
    towerDesc: '층을 올라 크리스탈 획득',
  },
  rack: {
    name: '양조대',
    claim: '+{n}',
    got: '양조대: 크리스탈 +{n}',
    full: '가득',
  },
  replayCut: '오늘 재도전: 크리스탈 절반',
  talents: {
    open: '특성',
    title: '{name}: 특성',
    both: 'Lv {n} 특성 둘 다',
    free: '모든 전투가 이 카드 효과로 시작. 언제든 무료 변경.',
  },
  catalyst: {
    title: '촉매: 하나 선택',
    held: '보유 ×{n}',
    volatile: {
      name: '휘발염',
      desc: '이번 등반 동안 반응 피해 +50%.',
    },
    wide: {
      name: '퍼지는 증기',
      desc: '이번 등반 동안 반응 범위 +30%.',
    },
    potent: {
      name: '농축액',
      desc: '모든 포션 피해 +20%.',
    },
    quick: {
      name: '수은',
      desc: '모든 포션 공격 속도 +15%.',
    },
    bulwark: {
      name: '석회 모르타르',
      desc: '성벽 최대 체력 +40%, 즉시 완전 수리.',
    },
    bounty: {
      name: '금박',
      desc: '적을 처치할 때마다 골드 +2.',
    },
  },
  rebrew: {
    button: '재양조',
    count: '재양조 횟수: {n}',
    essence: '정수: {n}',
    what: '모든 것을 가마솥에 다시 붓습니다: 캠페인은 1스테이지부터, 포션은 첫 레벨부터 다시 시작합니다. 도감, 반응 숙련, 재능, 별, 크리스탈, 연구소 절반은 유지되고 영구 보너스용 정수를 얻습니다.',
    go: '재양조: 정수 +{n}',
    sure: '한 번 더 눌러 확정',
    locked: '{n}스테이지 클리어 시 재양조',
    done: '재양조 완료! 정수 +{n}',
    perks: '영구 보너스',
    perk: {
      reaction: '반응 +{p}%',
      wall: '성벽 체력 +{p}%',
      gold: '시작 골드 +{n}',
      crystals: '크리스탈 +{p}%',
    },
  },
  week: {
    button: '이번 주',
    title: '이번 주',
    rule: '탑 규칙: {name}',
    left: '다음 주까지: {n}일',
    best: '이번 주 최고 층: {n}',
    play: '오르기',
    surge: {
      name: '쇄도',
      desc: '반응 피해 ×2, 적 체력 +30%.',
    },
    focus: {
      name: '집중',
      desc: '{name} 피해 ×4.',
    },
    glass: {
      name: '유리 대포',
      desc: '반응 피해 ×2.5, 포션 피해 -20%.',
    },
    brittle: {
      name: '약한 성벽',
      desc: '반응 피해 ×1.8, 성벽 체력 -25%.',
    },
    task: {
      kinds: '서로 다른 반응 {n}종 일으키기',
      react: '반응 {n}회 일으키기',
      tower: '탑 {n}층 도달',
      challenge: '일일 도전 {n}회 플레이',
    },
  },
  next: {
    find: '아직 {n}종의 반응을 찾지 못했어요: 새 조합을 시도해 보세요!',
    week: '이번 주 과제 보상을 받을 수 있어요',
    tower: '이번 주 탑: {name}. 최고 {n}층',
    rebrew: '캠페인 클리어: 재양조로 정수 {n}',
    perk: '사용할 정수: {n}',
  },
};
