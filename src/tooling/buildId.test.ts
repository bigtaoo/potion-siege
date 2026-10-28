import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDefine, buildId, git, bundleVersion, defaultSource } from '../../scripts/buildId.mjs';

// The build id every telemetry event carries, and the other values a build bakes into the client
// (scripts/buildId.mjs). Git is faked; the real one is only asked in the last test.

const fakeGit = (answers: Record<string, string>) => (args: string) => answers[args.split(' ')[0]] ?? '';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildId', () => {
  it('is the version and the commit, -dirty with uncommitted tracked changes', () => {
    expect(buildId(fakeGit({ 'rev-parse': '61b33eb' }), '0.0.1')).toBe('0.0.1+61b33eb');
    expect(buildId(fakeGit({ 'rev-parse': '61b33eb', status: 'M src/app.ts' }), '0.0.1')).toBe('0.0.1+61b33eb-dirty');
  });

  it('is the version alone without git', () => {
    expect(buildId(fakeGit({}), '1.2.3')).toBe('1.2.3');
  });

  it("reads the package's version and the checkout's commit by default", () => {
    expect(buildId()).toMatch(/^\d+\.\d+\.\d+(\+[0-9a-f]{7}(-dirty)?)?$/);
  });
});

describe('git', () => {
  it('answers a failing command with an empty string', () => {
    expect(git('no-such-command')).toBe('');
  });
});

describe('defaultSource', () => {
  it('is empty unless the build sets one, and keeps only safe characters', () => {
    vi.stubEnv('PS_DEFAULT_SRC', undefined);
    expect(defaultSource()).toBe('');
    vi.stubEnv('PS_DEFAULT_SRC', 'Playgama Sandbox/<x>');
    expect(defaultSource()).toBe('playgamasandboxx');
    vi.stubEnv('PS_DEFAULT_SRC', 'a'.repeat(60));
    expect(defaultSource()).toHaveLength(40);
  });
});

describe('bundleVersion', () => {
  it('is 0.0.0 outside the iOS workflows, which turns the update check off', () => {
    vi.stubEnv('PS_BUNDLE_VERSION', '');
    expect(bundleVersion()).toBe('0.0.0');
    vi.stubEnv('PS_BUNDLE_VERSION', '1.0.18');
    expect(bundleVersion()).toBe('1.0.18');
  });
});

describe('buildDefine', () => {
  it('hands Vite every value as a JSON string', () => {
    vi.stubEnv('PS_DEFAULT_SRC', 'itch');
    vi.stubEnv('PS_BUNDLE_VERSION', '1.0.18');
    const d = buildDefine();
    expect([JSON.parse(d.__PS_DEFAULT_SRC__), JSON.parse(d.__PS_BUNDLE__)]).toEqual(['itch', '1.0.18']);
    expect(JSON.parse(d.__PS_BUILD__)).toBe(buildId());
  });
});
