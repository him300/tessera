/**
 * Duration parsing. The four datasets contain all of these, written by hand:
 *
 *   20 · 20m · 20mins · 20 min · 1hour 20mins · 1h 15m · 1.5h · 82.33mins
 *   30sec · 4 hours+ · 2 hours 5min · 1hour and 11mins · Nothing · NaN
 *
 * Permissive about spacing, case and filler words. Strict about one thing: a unit
 * must be present for a value to be counted, except for a bare number, which is
 * minutes. Nothing is ever rounded up into a number the sheet does not hold.
 */

const PART = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;
const BARE = /^\d+(?:\.\d+)?$/;

export function isNothing(raw: string | null | undefined): boolean {
  const s = (raw ?? '').trim().toLowerCase();
  return !s || ['nothing', 'none', 'nan', 'n/a', '-'].includes(s);
}

/** Whole minutes, or null when the cell records no time. */
export function minutes(raw: string | null | undefined): number | null {
  const s = (raw ?? '').trim().toLowerCase().replace(/\u00a0/g, ' ');
  if (isNothing(s)) return null;

  let total = 0;
  let found = false;
  for (const m of s.matchAll(PART)) {
    const value = Number(m[1]);
    if (!Number.isFinite(value)) continue;
    found = true;
    total += m[2][0] === 'h' ? value * 60 : m[2][0] === 's' ? value / 60 : value;
  }
  if (!found) {
    const cleaned = s.replace(/\+/g, '').trim();
    if (!BARE.test(cleaned)) return null;
    const n = Math.floor(Number(cleaned));
    return n > 0 ? n : null;
  }
  const rounded = Math.round(total);
  return rounded > 0 ? rounded : null;
}

/** What to show under the field while typing: `1h 15m` → `75 min`. */
export const preview = (raw: string | null | undefined): string | null => {
  const m = minutes(raw);
  return m == null ? null : `${m} min`;
};
