// The collector's deploy (server/ci-deploy.sh): CI sends the collector's own files alone, and the box builds
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

  it("takes the collector's three files alone from CI, which sends nothing else", () => {
    const files = 'collector.mjs collectorLimits.mjs replayShelf.mjs';
    expect(deployScript).toContain(`FILES="${files}"`);
    expect(deployScript).toMatch(/tar xzf - -C "\$STAGE" [^\n]*\$FILES \|\|/);
    expect(deployScript).not.toMatch(/cp "\$STAGE\/(Dockerfile|docker-compose)/);
    expect(ciWorkflow).toContain(`tar czf - -C scripts ${files} |`);
    expect(ciWorkflow).not.toMatch(/tar czf[^\n]*(Dockerfile|docker-compose)/);
    expect(dockerfile).toContain(`COPY ${files} ./`);
  });

  it('pins every image to one release', () => {
    for (const image of [...dockerfile.matchAll(/^FROM (\S+)/gm), ...compose.matchAll(/^\s+image: (\S+)/gm)].map((m) => m[1])) {
      if (image === 'potion-siege-collector') continue;
      expect(image).toMatch(/:\d+\.\d+\.\d+(-[a-z]+)?$/);
    }
  });
});
