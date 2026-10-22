import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/stars.test.ts'], disableConsoleIntercept: true } });
