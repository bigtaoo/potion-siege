// Types for buildId.mjs, for the tests.

export function git(args: string): string;
export function buildId(run?: (args: string) => string, version?: string): string;
export function defaultSource(): string;
export function bundleVersion(): string;
export function buildDefine(): { __PS_BUILD__: string; __PS_DEFAULT_SRC__: string; __PS_BUNDLE__: string };
