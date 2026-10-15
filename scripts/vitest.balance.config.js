import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/balance.test.ts'], disableConsoleIntercept: true } });
