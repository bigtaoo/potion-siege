import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/replays.test.ts'], disableConsoleIntercept: true, testTimeout: 0 } });
