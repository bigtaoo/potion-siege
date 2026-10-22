// The panels that open by themselves on the way into the home screen (homeScreen.ts): one per
// visit, the consent question first, the daily login on the next visit.
import '../view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrivacyChoice } from '../analytics/privacy';
import { t } from '../i18n';
import { home } from './homeScreen';
import { englishPage, tap, veteran, world } from './testWorld';

beforeAll(englishPage);

/** A player back home after their second battle, in a region that asks before sharing. */
function secondVisit() {
  const m = veteran();
  m.runs = 2;
  const w = world(m);
  const g = w.game;
  (g as unknown as { privacy: PrivacyChoice }).privacy = new PrivacyChoice(w.host.storage, 'consent');
  g.loginShown = '';
  g.consentShown = false;
  const enter = () => {
    g['menu'].visible = false;
    home(g);
  };
  return { w, g, enter };
}

describe('panels on the way home', () => {
  it('opens the consent question alone, and the login on the next visit', () => {
    const { w, g, enter } = secondVisit();
    enter();
    expect(g.panel).toBe('privacy');
    tap(w.stage, t('privacy.decline'));
    expect(g.panel, 'no login straight after the consent answer').toBeNull();
    g.tab = 'potions';
    home(g);
    expect(g.panel, 'nor on a tab change in the same visit').toBeNull();
    enter();
    expect(g.panel).toBe('login');
  });

  it('opens the login on the first visit when there is no consent to ask', () => {
    const { g, enter } = secondVisit();
    g.privacy.set(true);
    enter();
    expect(g.panel).toBe('login');
  });
});
