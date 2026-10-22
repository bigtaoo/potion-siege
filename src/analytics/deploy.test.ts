// The collector's deploy (server/ci-deploy.sh): CI sends collector.mjs alone, and the box builds
// with the Dockerfile and compose file installed there by hand, which the script checks by
// hash. This keeps those hashes equal to server/'s copies (as committed: LF line ends).

import { describe, expect, it } from 'vitest';
import ciWorkflow from '../../.github/workflows/ci.yml?raw';
import deployScript from '../../server/ci-deploy.sh?raw';
import dockerfile from '../../server/Dockerfile?raw';
import compose from '../../server/docker-compose.yml?raw';

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.replace(/\r\n/g, '\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('collector deploy', () => {
  it('pins the hand-installed Dockerfile and compose file by hash', async () => {
    expect(deployScript).toContain(`DOCKERFILE_SHA256=${await sha256(dockerfile)}`);
    expect(deployScript).toContain(`COMPOSE_SHA256=${await sha256(compose)}`);
  });

  it('takes collector.mjs alone from CI, which sends nothing else', () => {
    expect(deployScript).toMatch(/tar xzf - -C "\$STAGE" [^\n]*collector\.mjs \|\|/);
    expect(deployScript).not.toMatch(/cp "\$STAGE\/(Dockerfile|docker-compose)/);
    expect(ciWorkflow).toContain('tar czf - -C scripts collector.mjs |');
    expect(ciWorkflow).not.toMatch(/tar czf[^\n]*(Dockerfile|docker-compose)/);
  });
});
