import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/early-curve.test.ts'], disableConsoleIntercept: true } });
