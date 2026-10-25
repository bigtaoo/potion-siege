import { defineConfig } from 'vite';

export default defineConfig({ test: { include: ['scripts/empty-field.test.ts'], disableConsoleIntercept: true } });
