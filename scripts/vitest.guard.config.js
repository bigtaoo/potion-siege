import { defineConfig } from 'vite';

// The balance guard: scripts/guard/*.test.ts pin the main curves of the balance suites on fewer
// cells and seeds, so a change to balance.json or src/sim that moves one fails CI. Times on a
// dev box (22 threads), files side by side:
//   quick (`npm run check:balance:quick`, inside `npm run check`):  lazy 2 s, endless 9 s
//   slow  (`npm run check:balance:slow`, its own CI step):  early 16 s, chapters 24 s, bosses 27 s
// The full suites stay manual, as they only print tables and take minutes (same box, one at a
// time): lazy 29 s, endless 123 s, chapters 133 s, bosses 155 s, early 231 s, balance 755 s,
// late 1012 s; economy 104 s as 18 shards side by side (about half an hour of CPU).
export default defineConfig({ test: { include: ['scripts/guard/*.test.ts'], disableConsoleIntercept: true } });
