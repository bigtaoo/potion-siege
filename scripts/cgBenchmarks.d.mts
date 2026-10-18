// Types for cgBenchmarks.mjs, for the tests.

export type Metric = 'conversion' | 'playtime' | 'd1';
export interface Point {
  at: number;
  score: number;
  kind: 'min' | 'seen';
}
export interface Range {
  lo: number;
  hi: number;
}
export interface DayScore {
  conversion: Range | null;
  playtime: Range | null;
  d1: Range | null;
  total: Range;
  pass: boolean | null;
}

export const BENCHMARKS: Record<string, Record<'desktop' | 'mobile', Record<Metric, Point[]>>>;
export const CATEGORY: string;
export const PASS: number;
export const METRICS: Metric[];
export function platformOf(device: string): 'desktop' | 'mobile';
export function scoreRange(points: Point[], value: number | null | undefined): Range | null;
export function scoreDay(values: Partial<Record<Metric, number | null>>, device: string, category?: string): DayScore;
export function rangeText(r: Range | null): string;
