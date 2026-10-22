import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/targeting.test.ts'], disableConsoleIntercept: true, testTimeout: 0 } });
