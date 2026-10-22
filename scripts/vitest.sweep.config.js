import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/mode-sweep.test.ts'], disableConsoleIntercept: true, testTimeout: 0 } });
