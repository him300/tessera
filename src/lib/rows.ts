/**
 * Rows in, rows out. One place that knows how a sheet row becomes an entry and how
 * an entry becomes a sheet row, so a value the site writes reads back identically.
 */

import { minutes as parseMinutes } from './duration';
import { DIMENSIONS, rowKeyOf, type DimKey, type Entry } from './model';
import { formatMinutes, parseAt, toSerial } from './times';

const text = (v: unknown) => String(v ?? '').trim();

/** Header cells, so a tab whose columns moved is still read correctly. */
function headIndex(header: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(text(h).toLowerCase().replace(/\s+/g, ' '), i));
  return map;
}

const col = (head: Map<string, number>, ...names: string[]) => {
  for (const n of names) {
    const i = head.get(n.toLowerCase());
    if (i != null) return i;
  }
  return -1;
};

/** A tab's values, header first, into entries. Unknown shapes are skipped, never guessed. */
export function entriesFromValues(dim: DimKey, values: unknown[][]): Entry[] {
  if (values.length === 0) return [];
  const head = headIndex(values[0]);
  const dimDef = DIMENSIONS[dim];
  const at = col(head, dimDef.columns[0], 'datetime', 'date');
  const time = col(head, 'time_allocated', 'time allocated');
  const payload = dimDef.columns.slice(1).map((name) => ({ name, index: col(head, name) }));

  const seen = new Map<string, number>();
  const out: Entry[] = [];
  for (const row of values.slice(1)) {
    const parsed = parseAt(at >= 0 ? row[at] : row[0]);
    if (!parsed) continue;
    const fields: Record<string, string> = {};
    for (const p of payload) fields[p.name] = p.index >= 0 ? text(row[p.index]) : '';
    const base = rowKeyOf(dim, parsed, 0);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({
      rowKey: rowKeyOf(dim, parsed, n),
      dim,
      at: parsed,
      minutes: parseMinutes(time >= 0 ? text(row[time]) : fields[dimDef.columns[1]] ?? ''),
      fields,
      ordinal: n,
      origin: 'sheet',
    });
  }
  return out;
}

/** One entry as the serial-and-text row the workbook holds. */
export function rowOf(dim: DimKey, entry: Entry): (string | number)[] {
  const dimDef = DIMENSIONS[dim];
  const first = toSerial(entry.at);
  const timeCell = entry.minutes != null ? formatMinutes(entry.minutes) : 'Nothing';
  return dimDef.columns.map((c, i) => {
    if (i === 0) return first;
    if (c === 'Time_Allocated' || c === 'Time Allocated') return timeCell;
    return entry.fields[c] ?? '';
  });
}
