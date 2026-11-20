/**
 * The one content file. Every visible string that is not a row of data lives here,
 * so the owner can change the words without touching markup.
 *
 * Assumptions recorded here (mirrored in the final hand-off):
 *  - the production URL is the deployed Worker: https://tessera.vandebeerjames.workers.dev
 *  - the record shown is the owner's own workbook, read once at build time
 */

import type { DimKey } from '@/lib/model';

export const site = {
  name: 'Tessera',
  /** one line, under 20 words */
  claim: 'Four dimensions, one record, a row per instant.',
  url: 'https://tessera.vandebeerjames.workers.dev',
  description:
    'A quiet ledger of learning, mind, body and success, kept in one Google workbook. Every day is laid on the floor, and every entry is a row that is never rewritten.',
  zone: 'Africa/Johannesburg',
  author: 'Tessera',
};

/** The palette, in one place. CSS reads these through custom properties set on <html>. */
export const HUES: Record<DimKey, { fill: string; ink: string; name: string }> = {
  learning: { fill: '#9C6B18', ink: '#6B4C0B', name: 'ochre' },
  mind: { fill: '#5B54C6', ink: '#3A348F', name: 'indigo' },
  body: { fill: '#2F7F5B', ink: '#17583C', name: 'green' },
  success: { fill: '#B6462A', ink: '#7F2E19', name: 'vermilion' },
};

export const COPY = {
  hero: {
    line1: 'Four dimensions,',
    line2: 'one record.',
    lede:
      'Learning, mind, body and success, kept by hand in one workbook and read back as a floor of days. One row per instant, appended, never rewritten.',
  },
  statement: {
    head: 'The sheet is the record. This is the lens.',
    body: [
      'The workbook came first: four tabs of rows typed by hand, four of them damaged in ways that took a day to find. Tessera does not replace the sheet and never rewrites it. It reads the four tabs, lays every day on one floor, and appends a row when you add an instant.',
      'A duplicated pass cannot happen here, because a duplicate is checked before a row is written. A day cannot go missing, because the top-up lays a 00:00 row on any day that has nothing in it, in the sheet’s own words.',
    ],
  },
  courses: {
    head: '4 dimensions, one floor',
    sub: 'Each dimension is a line of days. A minute recorded is a tile laid. Nothing recorded still gets a row, so the floor has no holes.',
  },
  entry: {
    head: 'One entry, one row',
    sub: 'Pick the dimension, pick the exact second, write the duration as you would say it. The row is appended to its tab and nowhere else.',
  },
  rules: {
    head: 'Four rules, checked every time',
    sub: 'The audit runs on every read. It reports; it never repairs. Anything a repair would change is a separate tap.',
  },
  footer: {
    line: 'The record is a workbook. This page is the reading surface.',
  },
};

export const RULES: { key: string; title: string; body: string }[] = [
  {
    key: 'append',
    title: 'Append only',
    body: 'There is no code path that rewrites a row that already exists. The four tabs keep their own columns, their own wording and their own order.',
  },
  {
    key: 'duplicate',
    title: 'One row per instant',
    body: 'Before anything is written, the dimension, the instant and the payload are hashed. A row that hashes to one already in the tab is refused.',
  },
  {
    key: 'day',
    title: 'Every day exists',
    body: 'A day with nothing on it gets one row at 00:00: Time_Allocated “Nothing”, Exercise “None”, reps “NaN”. The era’s sub-goal is inherited, never invented.',
  },
  {
    key: 'clock',
    title: 'Wall clock only',
    body: 'The workbook is set to Africa/Johannesburg and a stored value is never converted. Today is computed in that zone, never on the device.',
  },
];
