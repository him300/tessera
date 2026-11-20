'use client';

/**
 * The ledger: the workbook as a reading surface, not a grid.
 *
 * Two rules keep it readable. A day with a duration lists its rows. A run of days
 * with nothing on it collapses into one line, because the top-up fills those days at
 * 00:00 and six identical placeholder days should not push the record off the page.
 *
 * Tap a row to tag it. A tag is a row in the companion tab, so a re-sort in the sheet
 * can never move it to another row.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useNow } from '@/lib/clock';
import { DIMENSIONS, DIM_ORDER, TAG_KINDS, type DimKey, type Entry } from '@/lib/model';
import { store, useStore } from '@/lib/store';
import { dateOf, formatMinutes, prettyDayDate } from '@/lib/times';
import { Label, ShardMark, hue, hueVars } from './ui';

const PAGE = 200;

type Group =
  | { kind: 'day'; date: string; rows: Entry[]; minutes: number }
  | { kind: 'empty'; from: string; to: string; days: number; rows: number };

export function LedgerView({ day }: { day?: string }) {
  const { entries, tags } = useStore();
  const today = useNow();
  const [filter, setFilter] = useState<DimKey | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [query, setQuery] = useState('');

  /* one field, every token must match: the tile type, the date, the time, the row */
  const tokens = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);

  const haystack = (e: Entry) =>
    [
      DIMENSIONS[e.dim].label,
      e.dim,
      e.at,
      dateOf(e.at),
      prettyDayDate(dateOf(e.at)),
      e.at.slice(11, 16),
      DIMENSIONS[e.dim].line(e.fields),
      ...Object.values(e.fields).map(String),
    ]
      .join(' ')
      .toLowerCase();

  const rows = useMemo(
    () =>
      entries
        .filter((e) => (filter ? e.dim === filter : true))
        .filter((e) => (day ? dateOf(e.at) === day : true))
        .filter((e) => (tokens.length ? tokens.every((t) => haystack(e).includes(t)) : true))
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.dim < b.dim ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, filter, day, tokens],
  );

  const groups = useMemo<Group[]>(() => {
    const byDay = new Map<string, Entry[]>();
    for (const e of rows.slice(0, shown)) {
      const d = dateOf(e.at);
      const list = byDay.get(d);
      if (list) list.push(e);
      else byDay.set(d, [e]);
    }
    const out: Group[] = [];
    let run: { from: string; to: string; days: number; rows: number } | null = null;
    for (const [date, list] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
      const active = list.filter((e) => e.minutes != null);
      if (active.length === 0) {
        if (run && run.from === nextDay(date)) {
          run = { from: date, to: run.to, days: run.days + 1, rows: run.rows + list.length };
        } else {
          if (run) out.push({ kind: 'empty', ...run });
          run = { from: date, to: date, days: 1, rows: list.length };
        }
        continue;
      }
      if (run) {
        out.push({ kind: 'empty', ...run });
        run = null;
      }
      out.push({
        kind: 'day',
        date,
        rows: active,
        minutes: active.reduce((n, e) => n + (e.minutes ?? 0), 0),
      });
    }
    if (run) out.push({ kind: 'empty', ...run });
    return out;
  }, [rows, shown]);

  const tagsFor = (rowKey: string) => tags.filter((t) => t.rowKey === rowKey).map((t) => t.kind);

  return (
    <>
      <div className="ledsearch">
        <label className="ledsearch__label" htmlFor="ledger-search">
          Search
        </label>
        <span className="ledsearch__field">
          <input
            id="ledger-search"
            className="ledsearch__input"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="learning · 2026-11-09 · nov · 10:08 · 30mins"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="ledger-search-hint"
          />
          {query ? (
            <button type="button" className="ledsearch__clear" onClick={() => setQuery('')} aria-label="Clear the search">
              ✕
            </button>
          ) : null}
        </span>
        <span className="ledsearch__count">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="ledsearch__hint" id="ledger-search-hint">
        every token must match: the tile type, the date, the time, or the row's own words
      </p>

      <div className="chips" role="group" aria-label="Filter by dimension">
        <button className="chip" type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>
          All four
        </button>
        {DIM_ORDER.map((d) => (
          <button
            key={d}
            className="chip"
            type="button"
            aria-pressed={filter === d}
            onClick={() => setFilter(filter === d ? null : d)}
            style={{ '--hue': hue(d) } as CSSProperties}
          >
            <i />
            {DIMENSIONS[d].label}
          </button>
        ))}
        {day ? (
          <Link className="chip" href="/ledger" style={{ '--hue': hue('mind') } as CSSProperties}>
            {prettyDayDate(day)}
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Clear the day filter</span>
          </Link>
        ) : null}
        {query ? null : <span className="chips__count">{rows.length} rows</span>}
      </div>

      {groups.map((g) =>
        g.kind === 'empty' ? (
          <div className="empty-run" key={`${g.from}-${g.to}`}>
            <span className="empty-run__date">
              {g.days === 1 ? prettyDayDate(g.from) : `${prettyDayDate(g.from)} → ${prettyDayDate(g.to)}`}
            </span>
            <span className="empty-run__what">
              {g.days === 1 ? 'one day' : `${g.days} days`}, nothing recorded
            </span>
            <span className="empty-run__why">{g.rows} rows at 00:00</span>
          </div>
        ) : (
          <section className="daygroup" key={g.date} aria-label={prettyDayDate(g.date)}>
            <div className="daygroup__head">
              <h2 className="daygroup__date">{prettyDayDate(g.date)}</h2>
              <span className="daygroup__total">
                {formatMinutes(g.minutes)}
                {g.rows.length > 1 ? ` · ${g.rows.length} rows` : ''}
              </span>
            </div>
            <div className="rows">
              {g.rows.map((e) => {
                const mine = tagsFor(e.rowKey);
                const isOpen = open === e.rowKey;
                return (
                  <div key={e.rowKey} style={hueVars(e.dim)}>
                    <button
                      type="button"
                      className="lrow"
                      data-open={isOpen ? 'true' : undefined}
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : e.rowKey)}
                    >
                      <span className="lrow__time">{e.at.slice(11, 19)}</span>
                      <ShardMark dim={e.dim} on />
                      <span className="lrow__course">{DIMENSIONS[e.dim].label}</span>
                      <span className="lrow__line" data-course={DIMENSIONS[e.dim].label}>
                        {DIMENSIONS[e.dim].line(e.fields)}
                      </span>
                      <span className="lrow__fig">{DIMENSIONS[e.dim].figure(e.fields, e.minutes)}</span>
                      <span className="lrow__tags" aria-hidden="true">
                        {mine.length
                          ? mine.map((k) => TAG_KINDS.find((t) => t.key === k)?.label).join(' · ')
                          : '+'}
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="tags" role="group" aria-label={`Highlights for ${e.at.replace('T', ' ')}`}>
                        {TAG_KINDS.map((kind) => {
                          const on = mine.includes(kind.key);
                          return (
                            <button
                              key={kind.key}
                              type="button"
                              className="tag"
                              aria-pressed={on}
                              onClick={() => (on ? store.untag(e.rowKey, kind.key) : store.tag(e, kind.key))}
                            >
                              {on ? '✓ ' : ''}
                              {kind.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}

      {rows.length === 0 ? (
        <p className="prose" style={{ paddingBlock: 'var(--u)' }}>
          No rows for that filter. An empty dimension is still a dimension.
        </p>
      ) : null}

      {shown < rows.length ? (
        <div className="more">
          <button className="btn btn--ghost" type="button" onClick={() => setShown(shown + PAGE)}>
            <Label>Show {Math.min(PAGE, rows.length - shown)} more</Label>
          </button>
        </div>
      ) : rows.length > 0 ? (
        <div className="more">
          <span className="label">
            {rows.length} rows, ending {prettyDayDate(day ?? today)}
          </span>
        </div>
      ) : null}
    </>
  );
}

/** The previous calendar day of an ISO date, one day earlier. */
function nextDay(date: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
}
