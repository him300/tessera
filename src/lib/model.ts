/**
 * The four dimensions, and the shape of one row.
 *
 * Column names are the ones already in the workbook. The site never renames them,
 * so the sheets stay readable by hand.
 */

export type DimKey = 'learning' | 'mind' | 'body' | 'success';

export type Dimension = {
  key: DimKey;
  label: string;
  tab: string;
  /** first column holds the instant */
  columns: string[];
  /** the human line for a row */
  line: (fields: Record<string, string>) => string;
  /** the right-hand figure: reps, or the duration */
  figure: (fields: Record<string, string>, minutes: number | null) => string;
};

const t = (v?: string) => (v ?? '').trim();

export const DIM_ORDER: DimKey[] = ['learning', 'mind', 'body', 'success'];

export const DIMENSIONS: Record<DimKey, Dimension> = {
  learning: {
    key: 'learning',
    label: 'Learning',
    tab: 'Learning',
    columns: ['Date', 'Time_Allocated', 'Book_and_Page'],
    line: (f) => t(f.Book_and_Page) || 'nothing',
    figure: (_f, m) => (m == null ? '·' : `${m}m`),
  },
  mind: {
    key: 'mind',
    label: 'Mind',
    tab: 'Mind',
    columns: ['DateTime', 'Time Allocated', 'Meditation-Style'],
    line: (f) => t(f['Meditation-Style']) || 'nothing',
    figure: (_f, m) => (m == null ? '·' : `${m}m`),
  },
  body: {
    key: 'body',
    label: 'Body',
    tab: 'Body',
    columns: ['Date', 'Time_Allocated', 'Exercise', 'Number_Of_Reps', 'SubGoal', 'State Of SubGoal'],
    line: (f) => t(f.Exercise) || 'nothing',
    figure: (f, m) => {
      const reps = t(f.Number_Of_Reps);
      return reps && reps !== 'NaN' ? reps : m == null ? '·' : `${m}m`;
    },
  },
  success: {
    key: 'success',
    label: 'Success',
    tab: 'Success',
    columns: ['Date', 'Time_Allocated', 'Action_Took', 'SubGoal', 'State Of SubGoal'],
    line: (f) => t(f.Action_Took) || 'nothing',
    figure: (_f, m) => (m == null ? '·' : `${m}m`),
  },
};

export const dimOf = (key: string): Dimension => DIMENSIONS[key as DimKey] ?? DIMENSIONS.body;

/** One row of one dimension, normalised. `at` is wall clock, never a zone. */
export type Entry = {
  /** stable identity: dimension + instant + ordinal */
  rowKey: string;
  dim: DimKey;
  /** 'YYYY-MM-DDTHH:mm:ss', wall clock */
  at: string;
  minutes: number | null;
  fields: Record<string, string>;
  /** disambiguates two rows at the same instant (0-based, in sheet order) */
  ordinal: number;
  origin: 'sheet' | 'user' | 'topup';
};

export type TagKind = 'pr' | 'milestone' | 'insight' | 'review';

export const TAG_KINDS: { key: TagKind; label: string }[] = [
  { key: 'pr', label: 'PR' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'insight', label: 'Insight' },
  { key: 'review', label: 'Review' },
];

export type Tag = {
  rowKey: string;
  dim: DimKey;
  at: string;
  kind: TagKind;
  note: string;
  created: string;
};

export const rowKeyOf = (dim: DimKey, at: string, ordinal = 0) => `${dim}|${at}|${ordinal}`;

/** A placeholder is a row that records no time: the sheet's own word for nothing. */
export const isPlaceholder = (e: Entry): boolean => e.minutes == null;
