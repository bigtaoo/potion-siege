import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/first-seed.test.ts'], disableConsoleIntercept: true, testTimeout: 0 } });
