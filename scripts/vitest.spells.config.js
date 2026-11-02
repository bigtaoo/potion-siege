import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/spell-worth.test.ts'], disableConsoleIntercept: true, testTimeout: 0 } });
