// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: '광휘 토닉', metal: '수은 토닉', vine: '가시덤불 토닉' },
  role: { light: '관통 광선', metal: '강타', vine: '속박' },
  rx: { prism: '프리즘', flare: '섬광', magnetize: '자화', molten: '용융', spores: '포자', bramble: '서리 가시' },
  rxDo: {
    prism: '서리가 빛을 쪼갬: 가장 가까운 적 3명에게 광선',
    flare: '열기와 섬광이 폭발: 주변에 피해와 둔화',
    magnetize: '수은이 자석으로 변함: 주변 적을 끌어당김',
    molten: '수은이 끓어오름: 강한 화상',
    spores: '덩굴이 독꽃을 피움: 주변 모두 중독',
    bramble: '얼어붙은 가시가 솟음: 주변 적 모두 속박',
  },
  skill: {
    lightDamage: { name: '광채', desc: '광휘 토닉 피해 +40%' },
    lightWide: { name: '넓은 광선', desc: '광선 폭 +40%' },
    lightGlare: { name: '눈부심', desc: '광선이 지나간 적을 1초간 20% 감속' },
    lightFocus: { name: '집광', desc: '광선 위의 모든 적이 대상과 같은 피해를 받음' },
    lightFire: { name: '태양열', desc: '광선이 화염처럼 불태움' },
    metalDamage: { name: '헤비메탈', desc: '수은 토닉 피해 +40%' },
    metalShrapnel: { name: '파편', desc: '탄환이 타격 피해의 30%를 주변에 튀김' },
    metalCrush: { name: '넘어뜨리기', desc: '탄환이 15% 확률로 0.6초 넘어뜨림; 보스는 감속' },
    metalBreak: { name: '방어구 파괴', desc: '탄환이 적을 1.5초간 취약하게 함: 받는 피해 +40%' },
    metalFire: { name: '용광로', desc: '불타는 적에게 탄환 피해 +60%' },
    vineDamage: { name: '무성함', desc: '가시덤불 토닉 피해 +40%' },
    vineRoot: { name: '깊은 뿌리', desc: '속박 지속 시간 +30%' },
    vineThorns: { name: '가시', desc: '속박된 적이 초당 타격 피해의 40%만큼 출혈' },
    vineSpread: { name: '덩굴 뻗기', desc: '덩굴로 처치하면 가장 가까운 적을 속박' },
    vinePoison: { name: '독가시', desc: '덩굴 공격이 부식처럼 독을 묻힘' },
  },
  perk: {
    lightGlarePlus: '눈부심 감속 효과 +50%',
    metalCrushPlus: '넘어뜨리기 지속 시간 +50%',
    vineThornsPlus: '가시 피해 +50%',
  },
};
