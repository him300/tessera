'use client';

/**
 * One store, one state object, no backend.
 *
 * The record lives in this browser. The seed (the owner's 724 real rows) is merged
 * with whatever this browser has appended since, so the first paint is server
 * rendered from the sheet and every later paint includes your own rows.
 *
 * Nothing here rewrites a row that already exists. A row can be added, tagged or
 * (before it is written to a workbook) withdrawn. That is the whole vocabulary.
 */

import { useSyncExternalStore } from 'react';
import { DIM_ORDER, type DimKey, type Entry, type Tag, type TagKind, rowKeyOf } from './model';
import {
  lock as lockRecord,
  pull,
  push,
  unlock as unlockRecord,
  type Role,
  type StoreStatus,
} from './remote';
import { SEED_ENTRIES } from './seed';
import { placeholders, topUpThrough } from './topup';
import { addDays, dateOf, today as todayFn } from './times';

export type Settings = {
  /** fill every missing day with a row at 00:00 */
  autoTopUp: boolean;
  /** include today in the top-up, so a day never opens with a hole */
  includeToday: boolean;
  /**
   * One or more spreadsheets, in the order they were pasted. The first is the
   * primary: the sheet new rows are appended to. The rest are read alongside it.
   */
  workbooks: string[];
  clientId: string;
};

export type Flash = {
  id: number;
  text: string;
  detail?: string;
  undo?: boolean;
} | null;

export type State = {
  /** every row, seed then typed, oldest first */
  entries: Entry[];
  tags: Tag[];
  settings: Settings;
  flash: Flash;
  hydrated: boolean;
  /** rows this browser added and the workbook has not accepted yet */
  unsynced: string[];
  /** highlights this browser removed and the server has not heard about yet */
  pendingUnTag: { rowKey: string; kind: string }[];
  /** the highlight set changed since the last successful write */
  tagsDirty: boolean;
  /** where the durable record is, as far as this browser knows */
  store: StoreStatus;
  storeNote: string | null;
  /** rows the server holds, when it answered */
  storeTotal: number;
  /** what the key that opened this browser may do: write rows, or only read them */
  role: Role;
  /** the row this browser appended last, so the toast can withdraw it */
  last: string | null;
  topUp: { count: number; through: string; ids: string[]; at: string } | null;
};

const KEY = 'tessera.record.v1';

const DEFAULT_SETTINGS: Settings = {
  autoTopUp: true,
  includeToday: true,
  workbooks: [],
  clientId: '',
};

const sortEntries = (list: Entry[]) =>
  [...list].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : a.dim < b.dim ? -1 : a.dim > b.dim ? 1 : 0,
  );

/** Later rows win: the same row key can arrive from the seed and from storage. */
function dedupe(list: Entry[]): Entry[] {
  const map = new Map<string, Entry>();
  for (const e of list) map.set(e.rowKey, e);
  return sortEntries([...map.values()]);
}

/**
 * The seed, already topped up through today. Doing it here rather than in an effect
 * means the server and the browser paint the same floor, and a day that opens with
 * no row in it never gets a chance to shift the page as it fills.
 */
function seededEntries(): { entries: Entry[]; added: Entry[]; through: string } {
  const through = todayFn();
  const added: Entry[] = [];
  for (const dim of DIM_ORDER) {
    added.push(...placeholders(dim, SEED_ENTRIES.filter((e) => e.dim === dim), through));
  }
  return { entries: dedupe([...SEED_ENTRIES, ...added]), added, through };
}

const SEED = seededEntries();
const SEED_STATE = SEED.entries;

/** The rows the top-up laid on the seed are real rows this browser holds and the
 *  workbook does not have yet, so they start in the queue and can be withdrawn. */
const SEED_TOPUP: State['topUp'] =
  SEED.added.length > 0
    ? {
        count: SEED.added.length,
        through: SEED.through,
        ids: SEED.added.map((e) => e.rowKey),
        at: `${SEED.through}T00:05:00`,
      }
    : null;

let state: State = {
  entries: SEED_STATE,
  tags: [],
  settings: DEFAULT_SETTINGS,
  flash: null,
  hydrated: false,
  unsynced: SEED_TOPUP ? [...SEED_TOPUP.ids] : [],
  pendingUnTag: [],
  tagsDirty: false,
  store: 'unknown',
  storeNote: null,
  storeTotal: 0,
  role: 'full',
  last: null,
  topUp: SEED_TOPUP,
};

const listeners = new Set<() => void>();
let flashId = 0;
let hydratedOnce = false;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function persist() {
  if (typeof window === 'undefined') return;
  const extra = state.entries.filter((e) => e.origin !== 'sheet');
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        extra,
        tags: state.tags,
        settings: state.settings,
        unsynced: state.unsynced,
        pendingUnTag: state.pendingUnTag,
        tagsDirty: state.tagsDirty,
        topUp: state.topUp,
      }),
    );
  } catch {
    // A full quota must never break a save: the row is already in memory.
  }
}

function flash(text: string, detail?: string, undo = false) {
  flashId += 1;
  set({ flash: { id: flashId, text, detail, undo } });
  const mine = flashId;
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      if (state.flash?.id === mine) set({ flash: null });
    }, 3800);
  }
}

/**
 * Merge what the server holds into what is on screen, without touching a row this
 * browser already has. The server is the durable copy, not a second source of truth:
 * a row present in both places stays the row in memory.
 */
function adopted(remoteEntries: Entry[], remoteTags: Tag[]) {
  const known = new Set(state.entries.map((e) => e.rowKey));
  const fresh = remoteEntries.filter((e) => e && e.rowKey && !known.has(e.rowKey));
  const tags = [...state.tags];
  for (const t of remoteTags) {
    if (!tags.some((x) => x.rowKey === t.rowKey && x.kind === t.kind)) tags.push(t);
  }
  return { entries: sortEntries([...state.entries, ...fresh]), tags, fresh };
}

let flushing: Promise<void> | null = null;

/**
 * Send everything that exists only in this browser to the record. Called after every
 * write, so a row typed now is on the server a moment later; skipped when the record
 * is not open, so a locked or offline tab never spams the network.
 */
function flush(): Promise<void> {
  if (flushing) return flushing;
  if (state.store !== 'open') return Promise.resolve();
  if (state.role === 'view') return Promise.resolve();

  const pending = state.entries.filter((e) => state.unsynced.includes(e.rowKey));
  const removed = state.pendingUnTag;
  const sendTags = state.tagsDirty;
  if (pending.length === 0 && removed.length === 0 && !sendTags) return Promise.resolve();

  flushing = (async () => {
    const result = await push({
      entries: pending,
      tags: sendTags ? state.tags : [],
      removed,
    });
    if (result.status === 'open') {
      const done = new Set(pending.map((e) => e.rowKey));
      const gone = new Set(removed.map((r) => `${r.rowKey}|${r.kind}`));
      set({
        unsynced: state.unsynced.filter((k) => !done.has(k)),
        pendingUnTag: state.pendingUnTag.filter((r) => !gone.has(`${r.rowKey}|${r.kind}`)),
        tagsDirty: sendTags ? false : state.tagsDirty,
        store: 'open',
        storeNote: null,
        storeTotal: state.storeTotal + result.stored,
      });
      persist();
    } else {
      set({ store: result.status, storeNote: result.error });
    }
    flushing = null;
  })();

  return flushing;
}

export const store = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,

  /** Read this browser's record once, then keep the seed as the base. */
  hydrate() {
    if (hydratedOnce) return;
    hydratedOnce = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          extra?: Entry[];
          tags?: Tag[];
          settings?: Partial<Settings> & { workbook?: string };
          unsynced?: string[];
          pendingUnTag?: { rowKey: string; kind: string }[];
          tagsDirty?: boolean;
          topUp?: State['topUp'];
        };
        const extra = Array.isArray(saved.extra) ? saved.extra : [];
        const stored = saved.settings ?? {};
        // Older saves hold one `workbook` string; it becomes the first of the list.
        const workbooks = Array.isArray(stored.workbooks)
          ? stored.workbooks.filter((w): w is string => typeof w === 'string' && w.length > 0)
          : stored.workbook
            ? [stored.workbook]
            : [];
        const settings: Settings = { ...DEFAULT_SETTINGS, ...stored, workbooks };
        let merged = dedupe([...SEED_STATE, ...extra]);
        if (!settings.includeToday) {
          const t = todayFn();
          merged = merged.filter((e) => !(e.origin === 'topup' && dateOf(e.at) === t && !extra.some((x) => x.rowKey === e.rowKey)));
        }
        set({
          entries: merged,
          tags: Array.isArray(saved.tags) ? saved.tags : [],
          settings,
          unsynced: Array.isArray(saved.unsynced) ? saved.unsynced : [],
          pendingUnTag: Array.isArray(saved.pendingUnTag) ? saved.pendingUnTag : [],
          tagsDirty: saved.tagsDirty === true,
          topUp: saved.topUp ?? null,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  /**
   * Ask the record where it is. One read: open, locked, local only, or offline.
   * Called once after hydrate, and again whenever the key changes.
   */
  async connect() {
    if (typeof window === 'undefined') return state.store;
    const result = await pull();
    if (result.status === 'open') {
      const merged = adopted(result.entries, result.tags);
      const known = new Set(result.entries.map((e) => e.rowKey));
      set({
        entries: merged.entries,
        tags: merged.tags,
        unsynced: state.unsynced.filter((k) => !known.has(k)),
        store: 'open',
        storeNote: null,
        storeTotal: result.total,
        role: result.role,
      });
      persist();
      void flush();
    } else {
      set({
        store: result.status,
        storeNote: result.error,
        role: result.status === 'local' ? 'full' : state.role,
      });
    }
    return result.status;
  },

  /** Send what this browser holds. A no-op unless the record is open. */
  sync() {
    return flush();
  },

  /**
   * Present a key. On success the server sets the opening cookie, the record is read,
   * merged and the queue is flushed; on failure nothing about this browser changes.
   */
  async unlock(key: string) {
    const result = await unlockRecord(key);
    if (result.status !== 'open') return result;

    const merged = adopted(result.entries, result.tags);
    const known = new Set(result.entries.map((e) => e.rowKey));
    set({
      entries: merged.entries,
      tags: merged.tags,
      unsynced: state.unsynced.filter((k) => !known.has(k)),
      store: 'open',
      storeNote: null,
      storeTotal: result.total,
      role: result.role,
    });
    persist();
    void flush();
    return result;
  },

  /** Drop the opening cookie on this browser. The record is untouched; this tab stops writing. */
  async seal() {
    await lockRecord();
    set({ store: 'unknown', storeNote: null, storeTotal: 0 });
    // Ask again, so the page can say "locked" instead of "checking".
    await store.connect();
  },

  /** Append one row. The only write path in the app, and refused for a read-only key. */
  append(entry: Entry, note?: string) {
    if (state.role === 'view') {
      flash('That key can read the record, not write to it', 'Nothing was added.');
      return;
    }
    /**
     * A day that was empty got a 00:00 placeholder from the top-up. Now that a real row
     * exists for that dimension on that day, the placeholder is a lie: it says nothing
     * was recorded. Drop it if, and only if, this browser still holds it and no
     * workbook or server has taken it. Nothing that has been written is ever removed.
     */
    const day = entry.at.slice(0, 10);
    const replaced = state.entries.filter(
      (e) =>
        e.origin === 'topup' &&
        e.dim === entry.dim &&
        e.at.slice(0, 10) === day &&
        e.rowKey !== entry.rowKey &&
        state.unsynced.includes(e.rowKey),
    );
    const dropped = new Set(replaced.map((e) => e.rowKey));

    set({
      entries: sortEntries([...state.entries.filter((e) => !dropped.has(e.rowKey)), entry]),
      unsynced: [...state.unsynced.filter((k) => !dropped.has(k)), entry.rowKey],
      last: entry.rowKey,
    });
    persist();
    flash(note ?? `Appended to ${entry.dim}`, `${entry.at.slice(0, 10)} ${entry.at.slice(11, 16)}`, true);
    if (state.store === 'open') void flush();
  },

  /** Withdraw the most recent row, only while the workbook has not taken it. */
  undoAppend(rowKey: string) {
    const entry = state.entries.find((e) => e.rowKey === rowKey);
    if (!entry) return;
    const inSheet = entry.origin === 'sheet' || !state.unsynced.includes(rowKey);
    set({
      entries: state.entries.filter((e) => e.rowKey !== rowKey),
      tags: state.tags.filter((t) => t.rowKey !== rowKey),
      unsynced: state.unsynced.filter((k) => k !== rowKey),
      last: null,
      flash: inSheet
        ? { id: ++flashId, text: 'That row is in the workbook', detail: 'A sheet is append only: pull it back there.' }
        : null,
    });
    persist();
  },

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    set({ settings: { ...state.settings, [key]: value } });
    persist();
  },

  tag(entry: Entry, kind: TagKind) {
    if (state.tags.some((t) => t.rowKey === entry.rowKey && t.kind === kind)) return;
    const tag: Tag = {
      rowKey: entry.rowKey,
      dim: entry.dim,
      at: entry.at,
      kind,
      note: '',
      created: new Date().toISOString(),
    };
    set({ tags: [...state.tags, tag], tagsDirty: true });
    persist();
    if (state.store === 'open') void flush();
  },

  untag(rowKey: string, kind: TagKind) {
    set({
      tags: state.tags.filter((t) => !(t.rowKey === rowKey && t.kind === kind)),
      pendingUnTag: [...state.pendingUnTag, { rowKey, kind }].filter(
        (r, i, all) => all.findIndex((x) => x.rowKey === r.rowKey && x.kind === r.kind) === i,
      ),
      tagsDirty: true,
    });
    persist();
    if (state.store === 'open') void flush();
  },

  tagsFor: (rowKey: string) => state.tags.filter((t) => t.rowKey === rowKey).map((t) => t.kind),

  /**
   * Fill every day that has no row, at 00:00, in the sheet's own words.
   * Returns how many rows were laid.
   */
  topUp(opts: { quiet?: boolean } = {}) {
    const today = todayFn();
    const through = topUpThrough(today, state.settings.includeToday);
    const byDim = new Map<DimKey, Entry[]>();
    for (const e of state.entries) {
      const list = byDim.get(e.dim);
      if (list) list.push(e);
      else byDim.set(e.dim, [e]);
    }
    const added: Entry[] = [];
    for (const dim of ['learning', 'mind', 'body', 'success'] as DimKey[]) {
      const list = byDim.get(dim) ?? [];
      for (const p of placeholders(dim, list, through)) {
        if (!state.entries.some((e) => e.dim === dim && e.at.slice(0, 10) === p.at.slice(0, 10))) {
          added.push(p);
        }
      }
    }
    if (added.length === 0) {
      if (!opts.quiet) flash('Every day already has a row', `through ${through}`);
      return 0;
    }
    set({
      entries: sortEntries([...state.entries, ...added]),
      unsynced: [...state.unsynced, ...added.map((e) => e.rowKey)],
      topUp: { count: added.length, through, ids: added.map((e) => e.rowKey), at: new Date().toISOString() },
    });
    persist();
    if (!opts.quiet) {
      flash(`${added.length} days filled at 00:00`, `nothing recorded, so nothing claimed · through ${through}`);
    }
    if (state.store === 'open') void flush();
    return added.length;
  },

  /** Withdraw the rows the last top-up laid, while they are still only here. */
  withdrawTopUp() {
    const ids = new Set(state.topUp?.ids ?? []);
    if (ids.size === 0) return;
    const kept = state.entries.filter((e) => !(ids.has(e.rowKey) && state.unsynced.includes(e.rowKey)));
    const removed = state.entries.length - kept.length;
    set({ entries: kept, unsynced: state.unsynced.filter((k) => !ids.has(k)), topUp: null });
    persist();
    flash(`${removed} rows withdrawn`, 'only rows this browser still holds can be withdrawn');
  },

  markSynced(rowKeys: string[]) {
    const done = new Set(rowKeys);
    set({ unsynced: state.unsynced.filter((k) => !done.has(k)) });
    persist();
  },

  /** A workbook was read: replace every sheet-origin row with what it returned. */
  replaceFromSheet(sheetEntries: Entry[]) {
    const keep = state.entries.filter((e) => e.origin !== 'sheet');
    const known = new Set(sheetEntries.map((e) => e.rowKey));
    set({
      entries: dedupe([...sheetEntries, ...keep.filter((e) => !known.has(e.rowKey))]),
    });
    persist();
  },

  exportJSON(): string {
    return JSON.stringify(
      {
        taken: new Date().toISOString(),
        zone: 'Africa/Johannesburg',
        extra: state.entries.filter((e) => e.origin !== 'sheet'),
        tags: state.tags,
        settings: state.settings,
        topUp: state.topUp,
      },
      null,
      1,
    );
  },

  importJSON(text: string): { ok: boolean; rows: number } {
    try {
      const parsed = JSON.parse(text) as { extra?: Entry[]; tags?: Tag[] };
      const extra = (parsed.extra ?? []).filter((e) => e && e.at && e.dim);
      const tags = (parsed.tags ?? []).filter((t) => t && t.rowKey);
      if (!extra.length && !tags.length) return { ok: false, rows: 0 };
      const base = new Set(state.entries.map((e) => e.rowKey));
      const fresh = extra.filter((e) => !base.has(e.rowKey));
      set({
        entries: sortEntries([...state.entries, ...fresh]),
        tags: [...state.tags, ...tags.filter((t) => !state.tags.some((x) => x.rowKey === t.rowKey && x.kind === t.kind))],
      });
      persist();
      flash(`${fresh.length} rows imported`, 'nothing existing was touched');
      return { ok: true, rows: fresh.length };
    } catch {
      return { ok: false, rows: 0 };
    }
  },

  reset() {
    set({
      entries: SEED_STATE,
      tags: [],
      unsynced: [],
      pendingUnTag: [],
      tagsDirty: false,
      last: null,
      topUp: null,
      flash: null,
    });
    if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  },

  flash,
  dismissFlash: () => set({ flash: null }),
};

/** React binding. The snapshot is the state object, replaced on every change. */
export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** When a row is a top-up placeholder, its day; used by the ledger to group. */
export const keyOf = (dim: DimKey, at: string, ordinal = 0) => rowKeyOf(dim, at, ordinal);

export const yesterday = () => addDays(todayFn(), -1);
