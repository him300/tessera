/**
 * The durable record, on the server.
 *
 * Two tables in D1, one key that opens them, no ORM and no session. The row key the
 * client already computes is the primary key here, so "one row per instant" is a
 * constraint the database holds rather than a report the audit makes afterwards.
 *
 * Server only. Nothing in this file may be imported by a client component: it reads
 * a secret and the Workers binding.
 */

import type { DimKey, Entry, Tag, TagKind } from './model';

/* The slice of the D1 API this file uses, typed structurally so the build does not
   depend on a generated worker-configuration.d.ts. */
export type D1Result<T = Record<string, unknown>> = {
  results?: T[];
  success: boolean;
  meta?: { changes?: number };
};
export type D1Stmt = {
  bind(...values: unknown[]): D1Stmt;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
};
export type D1 = {
  prepare(sql: string): D1Stmt;
  batch<T = Record<string, unknown>>(statements: D1Stmt[]): Promise<D1Result<T>[]>;
};

export type ServerEnv = { DB?: D1; TESSERA_KEY?: string; TESSERA_VIEW_KEY?: string };

/** The Workers bindings, or null when this build has no server (plain `next start`). */
export async function serverEnv(): Promise<ServerEnv | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return env as unknown as ServerEnv;
  } catch {
    return null;
  }
}

const encoder = new TextEncoder();

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Compare the presented key to the stored one without leaking where they differ:
 * both sides are hashed, then compared byte by byte with no early exit.
 */
export async function keyOpens(presented: string, secret: string): Promise<boolean> {
  if (!presented || !secret) return false;
  const [a, b] = await Promise.all([digest(presented), digest(secret)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type EntryRow = {
  row_key: string;
  dim: string;
  at: string;
  ordinal: number;
  origin: string;
  minutes: number | null;
  fields: string;
};

type TagRow = {
  row_key: string;
  kind: string;
  dim: string;
  at: string;
  note: string;
  created: string;
};

export type RecordOut = { entries: Entry[]; tags: Tag[] };

/** Read the whole record. It is small on purpose: a few thousand rows at most. */
export async function readRecord(db: D1): Promise<RecordOut> {
  const [entries, tags] = await db.batch<EntryRow | TagRow>([
    db
      .prepare(
        'select row_key, dim, at, ordinal, origin, minutes, fields from entries order by at asc, dim asc, ordinal asc',
      ),
    db.prepare('select row_key, kind, dim, at, note, created from tags order by created asc'),
  ]);

  const out: RecordOut = { entries: [], tags: [] };

  for (const row of (entries?.results ?? []) as EntryRow[]) {
    let fields: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(row.fields || '{}');
      if (parsed && typeof parsed === 'object') fields = parsed as Record<string, string>;
    } catch {
      fields = {};
    }
    out.entries.push({
      rowKey: row.row_key,
      dim: row.dim as DimKey,
      at: row.at,
      minutes: row.minutes == null ? null : Number(row.minutes),
      fields,
      ordinal: Number(row.ordinal) || 0,
      origin: (row.origin === 'topup' ? 'topup' : 'user') as Entry['origin'],
    });
  }

  for (const row of (tags?.results ?? []) as TagRow[]) {
    out.tags.push({
      rowKey: row.row_key,
      dim: row.dim as DimKey,
      at: row.at,
      kind: row.kind as TagKind,
      note: row.note ?? '',
      created: row.created,
    });
  }

  return out;
}

const CHUNK = 40;

export type WriteIn = {
  entries?: Entry[];
  tags?: Tag[];
  removed?: { rowKey: string; kind: string }[];
  device?: string;
};

/**
 * Append. `on conflict do nothing` is the whole safety story: a retried request, a
 * double tap or two tabs posting the same row all land on one row.
 */
export async function writeRecord(db: D1, input: WriteIn): Promise<{ stored: number; tagged: number; removed: number }> {
  const now = new Date().toISOString();
  const device = (input.device ?? '').slice(0, 48) || null;

  const entryStatements = (input.entries ?? [])
    .filter((e) => e && e.rowKey && e.dim && e.at)
    .map((e) =>
      db
        .prepare(
          'insert into entries (row_key, dim, at, ordinal, origin, minutes, fields, device, created) values (?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict(row_key) do nothing',
        )
        .bind(
          e.rowKey,
          e.dim,
          e.at,
          Number.isFinite(e.ordinal) ? e.ordinal : 0,
          e.origin === 'topup' ? 'topup' : 'user',
          e.minutes == null ? null : e.minutes,
          JSON.stringify(e.fields ?? {}),
          device,
          now,
        ),
    );

  const tagStatements = (input.tags ?? [])
    .filter((t) => t && t.rowKey && t.kind)
    .map((t) =>
      db
        .prepare(
          'insert into tags (row_key, kind, dim, at, note, created) values (?, ?, ?, ?, ?, ?) on conflict(row_key, kind) do update set note = excluded.note',
        )
        .bind(t.rowKey, t.kind, t.dim, t.at, t.note ?? '', t.created || now),
    );

  const removeStatements = (input.removed ?? [])
    .filter((r) => r && r.rowKey && r.kind)
    .map((r) => db.prepare('delete from tags where row_key = ? and kind = ?').bind(r.rowKey, r.kind));

  let stored = 0;
  let tagged = 0;
  let removed = 0;

  for (let i = 0; i < entryStatements.length; i += CHUNK) {
    const results = await db.batch(entryStatements.slice(i, i + CHUNK));
    for (const r of results) stored += r.meta?.changes ?? 0;
  }
  for (let i = 0; i < tagStatements.length; i += CHUNK) {
    const results = await db.batch(tagStatements.slice(i, i + CHUNK));
    for (const r of results) tagged += r.meta?.changes ?? 0;
  }
  for (let i = 0; i < removeStatements.length; i += CHUNK) {
    const results = await db.batch(removeStatements.slice(i, i + CHUNK));
    for (const r of results) removed += r.meta?.changes ?? 0;
  }

  return { stored, tagged, removed };
}

/** Total rows held on the server, for the status line. */
export async function countRecord(db: D1): Promise<number> {
  const [r] = await db.batch<{ n: number }>([db.prepare('select count(*) as n from entries')]);
  return Number(r?.results?.[0]?.n ?? 0);
}
