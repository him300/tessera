'use client';

/**
 * The chosen day window, shared by the floor and the readout.
 *
 * One number, one subscription: 0 means the whole record. Both the floor's calendar
 * and the totals above it read the same value, so they can never disagree.
 */

import { useSyncExternalStore } from 'react';

let value = 28;
const listeners = new Set<() => void>();

export const rangeStore = {
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

export const useRange = () => useSyncExternalStore(rangeStore.subscribe, rangeStore.get, () => 28);

export const rangeLabel = (days: number) => (days === 0 ? 'the whole record' : `the last ${days} days`);
