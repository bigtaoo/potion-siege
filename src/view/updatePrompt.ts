// The hot-update panel over the home screen (game/updateFlow.ts decides when): an update is ready,
// Update or Later; then the download's bar, and at its end the game restarts by itself; or the
// failure, with Retry or Close. game/handle.ts keeps it over the stage and says when home is free.

import { Container, Graphics } from 'pixi.js';
import { t } from '../i18n';
import type { AppUpdates } from '../platform/types';
import { UpdateFlow, type UpdateStep } from '../game/updateFlow';
import { balanced, fit, lightPanel, P, PillButton, plate } from './kit';
import { label } from './ui';
import type { MenuFit } from './viewport';

const BOX_W = 900;
const BOX_H = 540;
const BAR_W = 700;
const BAR_H = 60;

export class UpdatePrompt {
  readonly flow: UpdateFlow;
  /** On the stage, over everything; empty while nothing is asked. */
  readonly view = new Container();
  private key = '';
  private dirty = false;

  constructor(updates: AppUpdates, now?: () => number) {
    this.flow = new UpdateFlow(updates, () => (this.dirty = true), now);
  }

  /** The game went to the background. */
  hidden(): void {
    this.flow.hidden();
  }

  /** Each frame: `idle` is home with nothing over it, `m` the menus' fit. */
  update(idle: boolean, m: MenuFit): void {
    this.flow.poll(idle);
    const key = `${m.w}x${m.h}@${m.scale}`;
    if (key !== this.key) {
      this.key = key;
      this.dirty = true;
    }
    if (this.dirty) this.draw(m);
  }

  private draw(m: MenuFit): void {
    this.dirty = false;
    for (const c of this.view.removeChildren()) c.destroy({ children: true });
    const s = this.flow.state;
    if (s.step === 'none') return;
    this.view.scale.set(m.scale);
    this.view.addChild(updatePanel(s, m, {
      update: () => this.flow.update(),
      later: () => this.flow.later(),
    }));
  }
}

interface UpdateActions {
  update(): void;
  later(): void;
}

function updatePanel(s: Exclude<UpdateStep, { step: 'none' }>, m: MenuFit, a: UpdateActions): Container {
  const root = new Container();
  // the shade takes every tap: nothing under it while the panel asks
  const shade = new Graphics().rect(0, 0, m.w, m.h).fill({ color: 0x3a2614, alpha: 0.6 });
  shade.eventMode = 'static';
  const box = new Container();
  box.position.set(m.w / 2, m.h / 2 + 20);
  box.scale.set(Math.min(1, (m.w - 40) / BOX_W, (m.h - 80) / (BOX_H + 60)));
  const top = -BOX_H / 2;
  const bg = lightPanel(BOX_W, BOX_H);
  const title = s.step === 'offer' ? t('update.title') : s.step === 'failed' ? t('update.failedTitle')
    : s.f >= 1 ? t('update.restarting') : t('update.downloading');
  const head = plate(title, 54, 420, s.step === 'failed' ? 'red' : 'brass', 760);
  head.y = top + 6;
  const body = s.step === 'offer' ? t('update.body') : s.step === 'failed' ? t('update.failed') : t('update.wait');
  const text = balanced(body, 40, BOX_W - 140, {});
  text.anchor.set(0.5, 0);
  if (text.height > 200) text.scale.set(200 / text.height);
  text.y = top + 90;
  box.addChild(bg, head, text);
  if (s.step === 'offer') {
    const version = label(t('update.version', { v: s.version }), 34, { fill: P.inkSoft, stroke: { color: P.ink, width: 0 } });
    version.y = top + 320;
    box.addChild(version);
  }
  if (s.step === 'downloading') {
    const bar = progressBar(s.f);
    bar.y = top + 380;
    box.addChild(bar);
  } else {
    const yes = new PillButton(s.step === 'offer' ? t('update.now') : t('update.retry'), 360, 110, 'green', a.update);
    const no = new PillButton(s.step === 'offer' ? t('update.later') : t('update.close'), 320, 110, 'brass', a.later);
    yes.position.set(-BOX_W / 2 + 60 + 180, top + BOX_H - 110);
    no.position.set(BOX_W / 2 - 60 - 160, top + BOX_H - 110);
    box.addChild(yes, no);
  }
  root.addChild(shade, box);
  return root;
}

/** The download's bar, with its percent on it. */
function progressBar(f: number): Container {
  const c = new Container();
  const fill = Math.max(0, Math.min(1, f));
  c.addChild(new Graphics()
    .roundRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, BAR_H / 2).fill(P.paperDark).stroke({ color: P.line, width: 5 }));
  if (fill > 0) {
    const fw = Math.max(BAR_H, BAR_W * fill);
    c.addChild(new Graphics().roundRect(-BAR_W / 2, -BAR_H / 2, fw, BAR_H, BAR_H / 2).fill(P.green).stroke({ color: P.line, width: 5 }));
  }
  const pct = fit(label(t('update.percent', { n: Math.round(fill * 100) }), 40, { stroke: { color: P.line, width: 6 } }), BAR_W - 40);
  c.addChild(pct);
  return c;
}
