// What the dev servers (the three vite configs) do not watch: the build outputs, the iOS shell,
// the captures under ref/ and local telemetry. On Windows a watch on a folder a build deletes and
// rewrites fires thousands of events a second and keeps an idle dev server at full CPU (Holy
// Kicker's 8267b39). Anchored at the repo root, so src/platform/ios/ is still watched.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const WATCH_IGNORED = ['dist*', 'ios', 'ref', 'telemetry'].map((d) => join(root, d, '**').replaceAll('\\', '/'));
