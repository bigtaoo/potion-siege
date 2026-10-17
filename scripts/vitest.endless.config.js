import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/endless.test.ts'], disableConsoleIntercept: true, testTimeout: 0 } });
