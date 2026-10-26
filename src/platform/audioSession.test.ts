import { describe, expect, it } from 'vitest';
import { shareSpeaker } from './audioSession';

describe('shareSpeaker', () => {
  it('asks for the ambient session, so the player\'s music keeps playing', () => {
    const nav = { audioSession: { type: 'auto' } };
    shareSpeaker(nav);
    expect(nav.audioSession.type).toBe('ambient');
  });

  it('does nothing where the browser has no audio session', () => {
    expect(() => shareSpeaker({})).not.toThrow();
    expect(() => shareSpeaker(undefined)).not.toThrow();
  });

  it('keeps going when the session refuses the type', () => {
    const nav = {
      audioSession: {
        get type() {
          return 'auto';
        },
        set type(_v: string) {
          throw new Error('refused');
        },
      },
    };
    expect(() => shareSpeaker(nav)).not.toThrow();
  });
});
