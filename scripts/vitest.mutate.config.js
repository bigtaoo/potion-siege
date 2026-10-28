import base from '../vite.config.js';

// Stryker's run (npm run mutate): only the sim's own tests judge the sim's mutants. The seed
// sweeps are left out: instrumented they run 10-15x slower and blow their own timeouts.
const SWEEPS = ['balance-targets', 'challengeOdds', 'softLock', 'skillFuzz'].map((f) => `src/sim/${f}.test.ts`);

export default {
  ...base,
  test: { ...base.test, include: ['src/sim/**/*.test.ts'], exclude: SWEEPS, testTimeout: 600_000 },
};
