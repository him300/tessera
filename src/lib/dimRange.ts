'use client';

/**
 * The window one dimension page is looking through. Presence, the plot and the river
 * all read it, so the strips and the stones can never describe different spans.
 * 0 means the whole record.
 */

import { useSyncExternalStore } from 'react';

export const DIM_RANGES = [
  { days: 28, label: '28' },
  { days: 56, label: '56' },
  { days: 90, label: '90' },
  { days: 180, label: '180' },
  { days: 0, label: 'all' },
] as const;

let value = 90;
const listeners = new Set<() => void>();

export const dimRange = {
  get: () => value,
  set(next: number) {
    if (next === value) return;
    value = next;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useDimRange = () => useSyncExternalStore(dimRange.subscribe, dimRange.get, () => 90);

/** how many days that window actually is, clamped to the record */
export function spanDays(entries: Array<{ at: string }>, today: string, wanted: number): number {
  if (wanted !== 0) return wanted;
  const dates = entries.map((e) => e.at.slice(0, 10)).sort();
  if (!dates.length) return 90;
  const n = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86_400_000) + 1;
  return Math.max(1, Math.min(1460, n));
}
