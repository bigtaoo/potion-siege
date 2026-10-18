// The playtest's one-time question on the result screen after a player's 3rd finished run: how
// much fun so far, 1 to 5, and an optional line of text. A plain HTML strip at the bottom of the
// page (a text field is the browser's job, not the canvas's), over nothing the result screen
// needs: its buttons keep working, and leaving the result screen takes the strip away. Sent as
// a `feedback` event ({rating, text}), or `feedback_skip` when it is closed or left unanswered.

import { t } from '../i18n';

/** The longest text kept. */
export const FEEDBACK_MAX = 200;
/** The finished run whose result screen asks. */
export const FEEDBACK_RUN = 3;

export type FeedbackSend = (name: 'feedback' | 'feedback_skip', props: Record<string, string | number>) => void;

const CSS = `
.ps-fb{position:fixed;left:50%;bottom:max(8px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10;
  width:min(420px,calc(100vw - 16px));box-sizing:border-box;padding:8px 12px;border-radius:14px;
  background:rgba(14,26,43,.94);border:2px solid #ffcf3f;color:#fff;font:600 15px/1.3 system-ui,sans-serif;
  touch-action:manipulation;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.ps-fb-row{display:flex;align-items:center;gap:8px}
.ps-fb-ask{flex:1}
.ps-fb button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:2px 6px}
.ps-fb .ps-fb-x{opacity:.7;font-size:14px}
.ps-fb-stars{flex:1;justify-content:center}
.ps-fb .ps-fb-star{font-size:28px;line-height:1;color:#5a6b80}
.ps-fb .ps-fb-star.on{color:#ffcf3f}
.ps-fb-note{margin-top:6px}
.ps-fb textarea{flex:1;min-width:0;box-sizing:border-box;height:2.6em;resize:none;border-radius:8px;
  border:1px solid #5a6b80;background:#1b2f45;color:#fff;font:400 16px/1.2 system-ui,sans-serif;padding:4px 8px;
  -webkit-user-select:text;user-select:text}
.ps-fb .ps-fb-send{background:#2f9e5b;border-radius:8px;padding:8px 14px}
`;

/** The question, once shown until `close` (or the player answers). */
export class FeedbackAsk {
  private readonly root: HTMLDivElement;
  private rating = 0;
  private done = false;
  private text: HTMLTextAreaElement | null = null;

  constructor(
    private readonly send: FeedbackSend,
    private readonly run: number,
    doc: Document = document,
  ) {
    if (!doc.getElementById('ps-fb-css')) {
      const style = doc.createElement('style');
      style.id = 'ps-fb-css';
      style.textContent = CSS;
      doc.head.appendChild(style);
    }
    this.root = doc.createElement('div');
    this.root.className = 'ps-fb';
    this.root.setAttribute('role', 'dialog');
    const head = doc.createElement('div');
    head.className = 'ps-fb-row';
    const ask = doc.createElement('span');
    ask.className = 'ps-fb-ask';
    ask.textContent = t('feedback.ask');
    const skip = doc.createElement('button');
    skip.className = 'ps-fb-x';
    skip.textContent = `${t('feedback.skip')} ✕`;
    skip.onclick = () => this.close('closed');
    head.append(ask, skip);
    const stars = doc.createElement('div');
    stars.className = 'ps-fb-row ps-fb-stars';
    const buttons: HTMLButtonElement[] = [];
    for (let i = 1; i <= 5; i++) {
      const star = doc.createElement('button');
      star.className = 'ps-fb-star';
      star.textContent = '★';
      star.setAttribute('aria-label', `${i}/5`);
      star.onclick = () => {
        this.rating = i;
        buttons.forEach((b, j) => b.classList.toggle('on', j < i));
        if (this.text) return;
        // the stars take the question's place, so the text line adds no height on a short phone
        head.replaceChild(stars, ask);
        this.addText(doc);
      };
      buttons.push(star);
    }
    stars.append(...buttons);
    this.root.append(head, stars);
    // the page keeps taps on the strip to itself, away from the canvas under it
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    doc.body.appendChild(this.root);
  }

  private addText(doc: Document): void {
    this.text = doc.createElement('textarea');
    this.text.maxLength = FEEDBACK_MAX;
    this.text.placeholder = t('feedback.note');
    const send = doc.createElement('button');
    send.className = 'ps-fb-send';
    send.textContent = t('feedback.send');
    send.onclick = () => this.submit();
    // one line under the stars, so the strip stays clear of the result screen's buttons on a phone
    const row = doc.createElement('div');
    row.className = 'ps-fb-row ps-fb-note';
    row.append(this.text, send);
    this.root.append(row);
  }

  private submit(): void {
    if (this.done) return;
    this.done = true;
    this.send('feedback', { rating: this.rating, text: (this.text?.value ?? '').trim().slice(0, FEEDBACK_MAX), run: this.run });
    this.root.replaceChildren(t('feedback.thanks'));
    setTimeout(() => this.root.remove(), 1500);
  }

  /** Takes the strip away: a rating already tapped is sent with whatever text there is. */
  close(how: 'closed' | 'left'): void {
    if (this.done) return;
    if (this.rating > 0) {
      this.submit();
      this.root.remove();
      return;
    }
    this.done = true;
    this.send('feedback_skip', { how, run: this.run });
    this.root.remove();
  }
}
