/**
 * The numbers behind every chart. Everything derives from an Entry list, so the
 * same code serves the sheets, the local store and the tests.
 */

import { isPlaceholder, type Entry } from './model';
import { addDays, dateOf, datesBetween, daysBetween, mondayOf, today as todayFn } from './times';

export type Day = { date: string; minutes: number; entries: number; active: boolean };

const sumMinutes = (list: Entry[]) => list.reduce((n, e) => n + (e.minutes ?? 0), 0);
const realRows = (list: Entry[]) => list.filter((e) => !isPlaceholder(e));
const uniq = (list: string[]) => [...new Set(list)];

/** One row per calendar day in a..b, whether or not anything happened. */
export function daily(entries: Entry[], from: string, to: string): Day[] {
  if (to < from) return [];
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = dateOf(e.at);
    const list = byDay.get(d);
    if (list) list.push(e);
    else byDay.set(d, [e]);
  }
  return datesBetween(from, to).map((date) => {
    const list = byDay.get(date) ?? [];
    const active = list.some((e) => !isPlaceholder(e));
    return { date, minutes: sumMinutes(list), entries: active ? realRows(list).length : 0, active };
  });
}

export const activeDays = (entries: Entry[]): Set<string> =>
  new Set(realRows(entries).map((e) => dateOf(e.at)));

/**
 * Consecutive active days ending today or yesterday. Yesterday is allowed so a
 * streak does not appear broken at 00:05.
 */
export function streak(entries: Entry[], today: string): number {
  const days = activeDays(entries);
  if (days.size === 0) return 0;
  let cursor: string;
  if (days.has(today)) cursor = today;
  else if (days.has(addDays(today, -1))) cursor = addDays(today, -1);
  else return 0;
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Active days ÷ calendar days, 0..1. */
export function consistency(entries: Entry[], from: string, to: string): number {
  const span = daysBetween(from, to) + 1;
  if (span <= 0) return 0;
  const active = [...activeDays(entries)].filter((d) => d >= from && d <= to).length;
  return active / span;
}

/** Minutes per ISO week, oldest first. */
export function weeklyMinutes(entries: Entry[], today: string, weeks: number): number[] {
  const monday = mondayOf(today);
  const out: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(monday, -7 * i);
    const end = addDays(start, 6);
    out.push(
      sumMinutes(entries.filter((e) => !isPlaceholder(e) && dateOf(e.at) >= start && dateOf(e.at) <= end)),
    );
  }
  return out;
}

/** Minutes per day, oldest first. */
export const minutesSeries = (entries: Entry[], today: string, days: number): number[] =>
  daily(entries, addDays(today, -(days - 1)), today).map((d) => d.minutes);

/** 1 where the day is active, 0 where not, oldest first. */
export const activeSeries = (entries: Entry[], today: string, days: number): number[] =>
  daily(entries, addDays(today, -(days - 1)), today).map((d) => (d.active ? 1 : 0));

/** Rolling count of active days over a window, one value per day. */
export function rollingActive(entries: Entry[], today: string, days: number, window = 7): number[] {
  const from = addDays(today, -(days - 1));
  const series = daily(entries, addDays(from, -(window - 1)), today).map((d) => (d.active ? 1 : 0));
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const idx = i + window - 1;
    if (idx >= series.length) break;
    out.push(series.slice(idx - window + 1, idx + 1).reduce<number>((a, b) => a + b, 0));
  }
  return out;
}

export function totalMinutes(entries: Entry[], from: string, to: string): number {
  return sumMinutes(
    entries.filter((e) => !isPlaceholder(e) && dateOf(e.at) >= from && dateOf(e.at) <= to),
  );
}

/** The last row that holds a duration: a placeholder is a row, not an entry. */
export const lastEntry = (entries: Entry[]): Entry | undefined =>
  [...entries].filter((e) => !isPlaceholder(e)).sort((a, b) => (a.at < b.at ? 1 : -1))[0];

export const firstDay = (entries: Entry[]): string | null => {
  const dates = entries.map((e) => dateOf(e.at)).sort();
  return dates[0] ?? null;
};
export const lastDay = (entries: Entry[]): string | null => {
  const dates = entries.map((e) => dateOf(e.at)).sort();
  return dates[dates.length - 1] ?? null;
};

export type Summary = {
  activeToday: boolean;
  minutesThisWeek: number;
  daysThisWeek: number;
  /** a rolling fortnight: the window a record that is read weekly actually fills */
  minutes14: number;
  days14: number;
  streak: number;
  consistency: number;
  activeLast3: number;
  totalEntries: number;
  totalMinutes: number;
  activeDays: number;
  longest: number;
  lastAt: string | null;
};

/** Everything the Today screen needs for one dimension. */
export function summary(entries: Entry[], today: string): Summary {
  const weekStart = mondayOf(today);
  const active = activeDays(entries);
  const last3 = [0, 1, 2].filter((o) => active.has(addDays(today, -o))).length;
  const from14 = addDays(today, -13);
  return {
    activeToday: active.has(today),
    minutesThisWeek: totalMinutes(entries, weekStart, today),
    daysThisWeek: uniq([...active].filter((d) => d >= weekStart && d <= today)).length,
    minutes14: totalMinutes(entries, from14, today),
    days14: uniq([...active].filter((d) => d >= from14 && d <= today)).length,
    streak: streak(entries, today),
    consistency: consistency(entries, addDays(today, -59), today),
    activeLast3: last3,
    totalEntries: realRows(entries).length,
    totalMinutes: sumMinutes(realRows(entries)),
    activeDays: active.size,
    longest: longestStreak(entries),
    lastAt: lastEntry(entries)?.at ?? null,
  };
}

export function longestStreak(entries: Entry[]): number {
  const days = [...activeDays(entries)].sort();
  if (days.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === addDays(days[i - 1], 1) ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Whole-record totals across all four dimensions. */
export function recordTotals(all: Entry[], today: string) {
  const real = realRows(all);
  const days = uniq(real.map((e) => dateOf(e.at)));
  const first = [...days].sort()[0] ?? null;
  const last = [...days].sort()[days.length - 1] ?? null;
  return {
    rows: all.length,
    realRows: real.length,
    minutes: sumMinutes(real),
    activeDays: days.length,
    firstDay: first,
    lastDay: last,
    span: first ? daysBetween(first, today) + 1 : 0,
    allFourToday: (['learning', 'mind', 'body', 'success'] as const).filter((d) =>
      real.some((e) => e.dim === d && dateOf(e.at) === today),
    ).length,
  };
}

/** Per day, how many of the four dimensions were active. */
export function aliveCount(all: Entry[], date: string): number {
  return (['learning', 'mind', 'body', 'success'] as const).filter((d) =>
    all.some((e) => e.dim === d && !isPlaceholder(e) && dateOf(e.at) === date),
  ).length;
}

export const todayDate = todayFn;
