// The dev-only audition page (sound-test.html): every effect and both loops, through the same
// engine the game uses, so the throttle and the crossfade are what the player hears.

import { GameAudio } from './engine';
import type { TrackId } from './music';
import type { SfxId } from './sfx';

const audio = new GameAudio();
audio.attach();
Object.assign(window, { __audio: audio });

const SOUNDS: [group: string, id: SfxId, name: string, note: string][] = [
  ['ui', 'tap', '点击 Tap', '所有按钮'],
  ['ui', 'summon', '召唤 Summon', '召唤一瓶药剂'],
  ['ui', 'merge', '合成 Merge', '咕嘟咕嘟的混合声'],
  ['ui', 'levelup', '升级 Level up', '选技能、买升级'],
  ['ui', 'crystal', '水晶 Crystal', '领取水晶、新格子'],
  ['ui', 'chest', '宝箱 Chest', '商店免费宝箱'],
  ['hit', 'hitArcane', '奥术 Arcane', '电弧 zap'],
  ['hit', 'hitFire', '火焰 Fire', '呼的一声 whoosh'],
  ['hit', 'hitIce', '冰霜 Ice', '碎裂 crack'],
  ['hit', 'hitLightning', '闪电 Lightning', '噼啪 crackle'],
  ['hit', 'hitPoison', '腐蚀 Corrosion', '滋滋 fizz'],
  ['hit', 'hitWind', '风 Wind', '一阵风 gust'],
  ['battle', 'kill', '敌人倒下 Kill', '发条零件散落'],
  ['battle', 'blast', '炼金爆瓶 Blast', '闷响 + 火焰 + 碎玻璃'],
  ['battle', 'wallHit', '城墙受击 Wall hit', '石头闷响'],
  ['battle', 'wave', '新一波 Wave', '铜号 + 钟'],
  ['battle', 'boss', 'BOSS 来袭', '低音号 + 锣 + 齿轮'],
  ['battle', 'win', '胜利 Win', '小号角 fanfare'],
  ['battle', 'lose', '失败 Lose', '下行小调'],
];

function button(name: string, note: string, onTap: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.innerHTML = `<b>${name}</b><small>${note}</small>`;
  b.addEventListener('click', onTap);
  return b;
}

for (const [group, id, name, note] of SOUNDS) {
  const box = document.querySelector(`[data-group="${group}"]`)!;
  box.append(button(name, note, () => audio.play(id)));
}
// a burst like a crowded wave: twenty hits of each kind in one frame, then a stream
const hits = SOUNDS.filter(([g]) => g === 'hit').map(([, id]) => id);
document.querySelector('[data-group="hit"]')!.append(
  button('连发 Spam ×120', '60 帧内 120 次命中', () => {
    let f = 0;
    const tick = () => {
      for (let i = 0; i < 2; i++) audio.play(hits[(f + i) % hits.length], { pan: Math.random() * 1.2 - 0.6 });
      for (let i = 0; i < 2; i++) audio.play('kill', { pan: Math.random() - 0.5, gain: 0.8 });
      if (++f < 60) requestAnimationFrame(tick);
    };
    tick();
  }),
);

const music = document.getElementById('music')!;
const tracks: [TrackId | null, string, string][] = [
  ['workshop', '工坊 Workshop', '菜单：轻柔，80 BPM，48 秒'],
  ['battle', '战斗 Battle', '战斗：更有推进力，116 BPM，33 秒'],
  [null, '停止 Stop', '淡出'],
];
const musicButtons = tracks.map(([id, name, note]) => {
  const b = button(name, note, () => {
    audio.music(id);
    musicButtons.forEach((x, i) => x.classList.toggle('on', tracks[i][0] === id && id !== null));
  });
  music.append(b);
  return b;
});

const prefs = { music: true, sfx: true };
const toggles = document.getElementById('toggles')!;
for (const [key, name] of [['music', '音乐 Music'], ['sfx', '音效 SFX']] as const) {
  const b = button(name, '开 ON', () => {
    prefs[key] = !prefs[key];
    audio.prefs(prefs);
    b.classList.toggle('on', prefs[key]);
    b.querySelector('small')!.textContent = prefs[key] ? '开 ON' : '关 OFF';
  });
  b.classList.add('on');
  toggles.append(b);
}
const ad = button('模拟广告 Ad (3 s)', 'Game.mute(true) → 静音', () => {
  audio.ad(true);
  ad.classList.add('on');
  setTimeout(() => {
    audio.ad(false);
    ad.classList.remove('on');
  }, 3000);
});
toggles.append(ad);

const status = document.getElementById('status')!;
setInterval(() => {
  const s = audio.status();
  status.textContent = ` [${s.state} · 音效 ${s.sfx}/${SOUNDS.length} · 音乐 ${s.tracks.join(', ') || '…'}]`;
}, 300);
