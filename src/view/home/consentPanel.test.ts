import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { englishPage, tap, texts } from '../../game/testWorld';
import { consentPanel } from './consentPanel';
import { loggedActions, PHONE } from './homeTestBits';

beforeAll(englishPage);

describe('consent panel', () => {
  it('asks once, with an answer each way', () => {
    const { act, calls } = loggedActions();
    const p = consentPanel(act, PHONE, false);
    expect(texts(p)).toEqual(expect.arrayContaining([t('privacy.title'), t('privacy.allow'), t('privacy.decline')]));
    tap(p, t('privacy.allow'));
    tap(p, t('privacy.decline'));
    expect(calls).toEqual([
      ['shareData', [true]],
      ['shareData', [false]],
    ]);
  });

  it('links the policy where the host allows a link out, else names its address', () => {
    const { act, calls } = loggedActions();
    const plain = texts(consentPanel(act, PHONE, false));
    expect(plain).not.toContain(t('sound.policy'));
    expect(plain).toContain(`${t('sound.policy')}: p.gamestao.com/privacy`);
    const p = consentPanel(act, PHONE, true);
    tap(p, t('sound.policy'));
    expect(calls).toEqual([['privacyPolicy', []]]);
  });

  it('makes a little more room for the link than for the address', () => {
    const { act } = loggedActions();
    const height = (policy: boolean) => consentPanel(act, PHONE, policy).children[1].getLocalBounds().height;
    expect(height(true) - height(false)).toBeCloseTo(30, 0);
  });

  it('closes on the cross without answering', () => {
    const { act, calls } = loggedActions();
    tap(consentPanel(act, PHONE, true), '✕');
    expect(calls).toEqual([['panel', [null]]]);
  });
});
