import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/chapter-curve.test.ts'], disableConsoleIntercept: true } });
