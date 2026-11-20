/**
 * The audit the app runs after every sync. It is the same audit that had to be
 * done by hand to repair these datasets, encoded so it cannot be forgotten.
 *
 * Nothing here writes. A report is a list of facts, and every repair is a
 * separate, user-initiated action.
 */

import { DIMENSIONS, dimOf, isPlaceholder, type DimKey, type Entry } from './model';
import { dateOf, datesBetween, daysBetween } from './times';

export type IssueKind = 'order' | 'duplicate' | 'gap' | 'format';

export type Issue = { kind: IssueKind; detail: string; date?: string };

export type Report = {
  dim: DimKey;
  rows: number;
  activeDays: number;
  spanDays: number;
  firstDay: string | null;
  lastDay: string | null;
  issues: Issue[];
  healthy: boolean;
  missingDays: string[];
};

/** Content hash, used to catch the same row written twice. */
function fingerprint(e: Entry): string {
  const payload = DIMENSIONS[e.dim].columns
    .slice(1)
    .map((c) => (e.fields[c] ?? '').trim())
    .join('|');
  let h = 5381;
  const s = `${e.dim}|${e.at}|${payload}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export function check(dim: DimKey, entries: Entry[]): Report {
  const issues: Issue[] = [];

  // 1. ordering is judged on arrival order, so sorting can never defeat the check
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].at < entries[i - 1].at) {
      issues.push({
        kind: 'order',
        detail: `row ${i + 1} (${entries[i].at.slice(0, 16)}) is earlier than row ${i}`,
      });
      break;
    }
  }

  // 2. duplicates: same instant, same payload, twice
  const ordered = [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const seen = new Map<string, number>();
  for (const e of ordered) {
    const fp = fingerprint(e);
    const n = (seen.get(fp) ?? 0) + 1;
    seen.set(fp, n);
    if (n === 2) issues.push({ kind: 'duplicate', detail: `duplicate row at ${e.at.slice(0, 16)}`, date: dateOf(e.at) });
  }

  // 3. completeness: every day between first and last must exist
  const first = ordered[0]?.at.slice(0, 10) ?? null;
  const last = ordered[ordered.length - 1]?.at.slice(0, 10) ?? null;
  const missing: string[] = [];
  if (first && last) {
    const have = new Set(ordered.map((e) => dateOf(e.at)));
    for (const d of datesBetween(first, last)) {
      if (!have.has(d)) {
        missing.push(d);
        issues.push({ kind: 'gap', detail: d, date: d });
      }
    }
  }

  // 4. format: an instant outside a plausible century cannot be ordered
  for (const e of entries) {
    const year = Number(e.at.slice(0, 4));
    if (year < 2000 || year > 2100) {
      issues.push({ kind: 'format', detail: `implausible instant ${e.at}` });
      break;
    }
  }

  const active = new Set(entries.filter((e) => !isPlaceholder(e)).map((e) => dateOf(e.at)));
  return {
    dim,
    rows: entries.length,
    activeDays: active.size,
    spanDays: first && last ? daysBetween(first, last) + 1 : 0,
    firstDay: first,
    lastDay: last,
    issues,
    healthy: issues.every((i) => i.kind === 'format'),
    missingDays: missing,
  };
}

export const checkAll = (byDim: Record<DimKey, Entry[]>) =>
  (Object.keys(byDim) as DimKey[]).map((d) => check(d, byDim[d]));

export const issueLabel = (kind: IssueKind) =>
  kind === 'order' ? 'Order' : kind === 'duplicate' ? 'Duplicate' : kind === 'gap' ? 'Gap' : 'Format';

export const dimLabel = (d: DimKey) => dimOf(d).label;
