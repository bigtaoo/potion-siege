import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/economy.test.ts'], disableConsoleIntercept: true } });
