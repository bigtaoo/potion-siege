// The collector's save copies (saveVault.mjs), as its tests use them.

export const KEEP_MONTHS: number;
export const MAX_SAVE: number;

/** A posted copy as the vault takes it. */
export interface VaultCopy {
  id: string;
  token: string;
  acct?: string;
  save: string;
}

export function cleanSave(body: unknown): VaultCopy | null;
export function acctOfQuery(url: string): string | null;

export class SaveVault {
  constructor(dir: string, log?: (line: string) => void);
  put(copy: VaultCopy, now: number): 'kept' | 'refused';
  get(acct: string): { at: number; save: string } | null;
  prune(now: number): number;
}
