// The shell's storage keys and the build stamp.

export const SAVE_KEY = 'mb.save';
/** The language picked in the settings, if any; the device's own language otherwise. */
export const LANG_KEY = 'mb.lang';
/** `version+commit`, stamped at build time (scripts/buildId.mjs), e.g. 0.0.1+61b33eb. */
export const BUILD = __PS_BUILD__;
/** The device's answer to the reminders card (game/reminderBook.ts): wanted, and whether it was answered. */
export const REMINDERS_KEY = 'ps.reminders';
