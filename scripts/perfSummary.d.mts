// Types for perfSummary.mjs, for the tests.

export interface Row {
  n: number;
  mins: number;
  fps: number | null;
  p5: number | null;
  longPerMin: number | null;
}

export interface PerfSummary {
  snapshots: number;
  why: Record<string, number>;
  all: Row;
  byGpu: (Row & { gpu: string })[];
  byCores: (Row & { cores: string })[];
  longTasks: { n: number; msPerMin: number | null; perMin: number | null };
  byNth: { nth: number; n: number; nodes0: number | null; nodesUp: number | null; tex0: number | null; texUp: number | null; heap0: number | null; heapUp: number | null }[];
  anomalies: Record<string, number>;
  topErrors: [string, number][];
}

export function median(xs: number[]): number | null;
export function coresBucket(n: number | undefined): string;
export function perfSummary(events: { name: string; sid: string; props: Record<string, unknown> }[]): PerfSummary;
export function printPerf(s: PerfSummary, log?: (line: string) => void): void;
