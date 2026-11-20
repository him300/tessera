/**
 * The top-up: every day must exist.
 *
 * A day with no row at all is a hole in the record, and a hole is the one thing a
 * ledger cannot have. So a missing day gets one row at 00:00, written in the same
 * words the sheet already uses for an empty day, so a row the app fills is
 * indistinguishable from one typed by hand.
 *
 * A filled day inherits the sub-goal that was in force at that time, taken from the
 * nearest preceding row. It never copies a future sub-goal backwards.
 *
 * On the phone this ran at 00:05. Here it runs whenever the record opens, which is
 * the same promise kept at a different hour, and it can be switched off.
 */

import { dateOf } from './times';
import { addDays, datesBetween } from './times';
import { type DimKey, type Entry } from './model';

const BODY_GOAL = 'Build A Steady Practice';
const SUCCESS_GOAL = 'Ship One Small Thing Each Week';

/** The row that fills `day`, in the era's own wording. */
export function placeholder(dim: DimKey, orderedAscending: Entry[], day: string): Entry {
  const at = `${day}T00:00:00`;
  const carry =
    [...orderedAscending].reverse().find((e) => e.at < at) ??
    orderedAscending.find((e) => e.at > at) ??
    null;

  const carryField = (key: string, fallback: string) => {
    const v = (carry?.fields?.[key] ?? '').trim();
    return v || fallback;
  };

  const fields: Record<string, string> =
    dim === 'learning'
      ? { Time_Allocated: 'Nothing', Book_and_Page: '(nothing,nothing)' }
      : dim === 'mind'
        ? { 'Time Allocated': 'Nothing', 'Meditation-Style': 'None' }
        : dim === 'body'
          ? {
              Time_Allocated: 'Nothing',
              Exercise: 'None',
              Number_Of_Reps: 'NaN',
              SubGoal: carryField('SubGoal', BODY_GOAL),
              'State Of SubGoal': carryField('State Of SubGoal', '0'),
            }
          : {
              Time_Allocated: 'Nothing',
              Action_Took: 'Nothing',
              SubGoal: carryField('SubGoal', SUCCESS_GOAL),
              'State Of SubGoal': carryField('State Of SubGoal', '0'),
            };

  return {
    rowKey: `${dim}|${at}|0`,
    dim,
    at,
    minutes: null,
    fields,
    ordinal: 0,
    origin: 'topup',
  };
}

/**
 * Every missing day from the record's first row through `through`, oldest first.
 * Returns [] when the dimension has nothing at all yet: the app will not invent a
 * record where none exists.
 */
export function placeholders(dim: DimKey, entries: Entry[], through: string): Entry[] {
  if (entries.length === 0) return [];
  const ordered = [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const first = dateOf(ordered[0].at);
  const last = dateOf(ordered[ordered.length - 1].at);
  const end = through > last ? through : last;
  const have = new Set(ordered.map((e) => dateOf(e.at)));
  const out: Entry[] = [];
  for (const day of datesBetween(first, end)) {
    if (!have.has(day)) out.push(placeholder(dim, ordered, day));
  }
  return out;
}

/** What "today" means for a top-up run, given the switch that keeps today open. */
export const topUpThrough = (today: string, includeToday: boolean): string =>
  includeToday ? today : addDays(today, -1);
