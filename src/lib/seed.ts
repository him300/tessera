/**
 * The seed is a synthetic demo record: 724 rows in the shape of the four sheets,
 * generated once so the floor has something to paint. Not a real person's data.
 *
 * It is imported statically so the first paint is server-rendered from the seed.
 */

import raw from '@/data/seed.json';
import { minutes } from './duration';
import { rowKeyOf, type DimKey, type Entry } from './model';
import { parseAt } from './times';

type SeedRow = Record<string, unknown>;

type SeedFile = {
  learning: { at: string; time: string; book: string }[];
  mind: { at: string; time: string; style: string }[];
  body: { serial: number; time: string; exercise: string; reps: string; subGoal: string; state: string }[];
  success: { at: unknown; time: string; action: string; subGoal: string; state: string }[];
};

const file = raw as unknown as SeedFile;

const clean = (v: unknown) => String(v ?? '').trim();

function build(dim: DimKey, rows: SeedRow[], pick: (r: SeedRow) => Record<string, string>): Entry[] {
  const seen = new Map<string, number>();
  const out: Entry[] = [];
  for (const row of rows) {
    const at = parseAt(row.at ?? row.serial);
    if (!at) continue;
    const fields = pick(row);
    const time = fields.Time_Allocated ?? fields['Time Allocated'] ?? '';
    const base = rowKeyOf(dim, at, 0);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({
      rowKey: rowKeyOf(dim, at, n),
      dim,
      at,
      minutes: minutes(time),
      fields,
      ordinal: n,
      origin: 'sheet',
    });
  }
  return out;
}

export const SEED_ENTRIES: Entry[] = [
  ...build('learning', file.learning as unknown as SeedRow[], (r) => ({
    Time_Allocated: clean(r.time),
    Book_and_Page: clean(r.book),
  })),
  ...build('mind', file.mind as unknown as SeedRow[], (r) => ({
    'Time Allocated': clean(r.time),
    'Meditation-Style': clean(r.style),
  })),
  ...build('body', file.body as unknown as SeedRow[], (r) => ({
    Time_Allocated: clean(r.time),
    Exercise: clean(r.exercise),
    Number_Of_Reps: clean(r.reps),
    SubGoal: clean(r.subGoal),
    'State Of SubGoal': clean(r.state),
  })),
  ...build('success', file.success as unknown as SeedRow[], (r) => ({
    Time_Allocated: clean(r.time),
    Action_Took: clean(r.action),
    SubGoal: clean(r.subGoal),
    'State Of SubGoal': clean(r.state),
  })),
].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.dim < b.dim ? -1 : 1));

/** The record as it arrived, before anything the visitor does. */
export const SEED_ROWS = SEED_ENTRIES.length;
