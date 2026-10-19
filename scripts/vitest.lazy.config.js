import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/lazy-curve.test.ts'], disableConsoleIntercept: true } });
