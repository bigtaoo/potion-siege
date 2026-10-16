import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/late-game.test.ts'], disableConsoleIntercept: true } });
