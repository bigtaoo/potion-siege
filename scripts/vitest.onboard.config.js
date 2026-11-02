import { defineConfig } from 'vite';
import { buildDefine } from './buildId.mjs';

// the real Game: it needs the build stamp the app's config defines
export default defineConfig({ define: buildDefine(), test: { include: ['scripts/onboard.test.ts'], disableConsoleIntercept: true } });
