import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/bosses.test.ts'], disableConsoleIntercept: true } });
