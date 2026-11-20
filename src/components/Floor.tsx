'use client';

/**
 * The floor: a weekday calendar of days. Every tile carries all four courses as four
 * shards in workbook order. Pointing at a tile lifts its values beside it; clicking a
 * tile pins them, and clicking it again lets go.
 */

import { useMemo, useRef, useState } from 'react';
import { useNow } from '@/lib/clock';
import { DIMENSIONS, DIM_ORDER } from '@/lib/model';
import { useStore } from '@/lib/store';
import { addDays, dateOf, formatMinutes, prettyDate } from '@/lib/times';
import { hue } from './ui';
import { Tip, rectOf, type Anchor } from './Tip';
import { rangeStore, useRange } from '@/lib/range';

const RANGES = [
  { days: 28, label: '28' },
  { days: 56, label: '56' },
  { days: 84, label: '84' },
  { days: 180, label: '180' },
  { days: 0, label: 'all' },
] as const;

const DEFAULT_DAYS = 28;
const COLS = 14;
const lv = (m: number) => (m === 0 ? 0 : m <= 4 ? 1 : m <= 9 ? 2 : m <= 19 ? 3 : m <= 29 ? 4 : 5);
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Cell = { day: string; per: number[]; total: number; delay: number };

export function Floor() {
  const { entries } = useStore();
  const today = useNow();
  const days = useRange();
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const point = (el: HTMLElement) => setAnchor(rectOf(el));

  /* "all" is the whole record, not a bigger number */
  const span = useMemo(() => {
    if (days !== 0) return days;
    const dates = entries.map((e) => dateOf(e.at)).sort();
    if (!dates.length) return DEFAULT_DAYS;
    const n =
      Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86_400_000) + 1;
    return Math.max(1, Math.min(1460, n));
  }, [days, entries, today]);

  const cells = useMemo<Array<Cell | null>>(() => {
    const start = addDays(today, -(span - 1));
    const byDay = new Map<string, Record<string, number>>();
    entries.forEach((e) => {
      if (e.minutes == null) return;
      const d = dateOf(e.at);
      const row = byDay.get(d) ?? {};
      row[e.dim] = (row[e.dim] ?? 0) + e.minutes;
      byDay.set(d, row);
    });

    const firstWeekday = WEEKDAYS.indexOf(
      new Date(`${start}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    );
    const pad = Math.max(0, firstWeekday);

    const out = Array.from({ length: span }, (_, i) => {
      const day = addDays(start, i);
      const row = byDay.get(day) ?? {};
      const per = DIM_ORDER.map((dim) => row[dim] ?? 0);
      return {
        day,
        per,
        total: per.reduce((n, v) => n + v, 0),
        delay: (i + pad) % COLS + Math.floor((i + pad) / COLS) * 2,
      };
    });

    return [...Array.from({ length: pad }, () => null), ...out];
  }, [entries, today, span]);

  const real = cells.filter((c): c is Cell => c !== null);
  const lit = real.filter((c) => c.total > 0).length;

  /* the tile that owns the readout: a pin beats a pointer */
  const shownIndex = pinned ?? hover;
  const shown = shownIndex == null ? null : cells[shownIndex];

  const toggle = (i: number) => {
    setPinned((p) => {
      const next = p === i ? null : i;
      if (next === null) setAnchor(null);
      else {
        const el = grid.current?.children[i] as HTMLElement | undefined;
        if (el) point(el);
      }
      return next;
    });
  };



  return (
    <div className="os-floor">
      <div className="os-row" role="group" aria-label="Days shown" style={{ marginBottom: '0.7rem' }}>
        <span className="os-tag">days</span>
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            className="os-chip"
            aria-pressed={days === r.days}
            onClick={() => {
              rangeStore.set(r.days);
              setHover(null);
              setPinned(null);
            }}
          >
            {r.label}
          </button>
        ))}
        {pinned != null ? (
          <button type="button" className="os-chip" style={{ marginLeft: 'auto' }} onClick={() => setPinned(null)}>
            clear pin
          </button>
        ) : null}
      </div>

      <div className="os-floor__grid" ref={grid} style={{ ['--cols' as string]: COLS }}>
        {cells.map((cell, i) =>
          cell === null ? (
            <span key={`pad${i}`} aria-hidden="true" />
          ) : (
            <button
              key={cell.day}
              type="button"
              className="os-tile os-tile--day"
              data-pinned={pinned === i ? '1' : undefined}
              style={{ ['--d' as string]: cell.delay }}
              aria-pressed={pinned === i}
              aria-label={`${prettyDate(cell.day)}. ${DIM_ORDER.map(
                (dim, k) => `${DIMENSIONS[dim].label} ${cell.per[k] ? `${cell.per[k]} minutes` : 'nothing'}`,
              ).join(', ')}.`}
              onPointerEnter={(e) => { setHover(i); point(e.currentTarget); }}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={(e) => { setHover(i); point(e.currentTarget); }}
              onBlur={() => setHover((h) => (h === i ? null : h))}
              onClick={(e) => { point(e.currentTarget); toggle(i); }}
            >
              {cell.per.map((min, k) => (
                <span
                  key={DIM_ORDER[k]}
                  data-lv={lv(min) || undefined}
                  style={{ ['--hue' as string]: hue(DIM_ORDER[k]) }}
                />
              ))}
            </button>
          ),
        )}

        {shown ? (
          <Tip at={anchor}>
            <div>
            <p className="os-tip__day">
              {prettyDate(shown.day)}
              {pinned != null ? <em>pinned</em> : null}
            </p>
            {DIM_ORDER.map((dim, k) => (
              <p className="os-tip__row" key={dim}>
                <i aria-hidden="true" style={{ background: hue(dim) }} />
                <span>{DIMENSIONS[dim].label}</span>
                <b>{shown.per[k] ? `${shown.per[k]}m` : '—'}</b>
              </p>
            ))}
            <p className="os-tip__sum">{shown.total ? formatMinutes(shown.total) : 'nothing kept'}</p>
            </div>
          </Tip>
        ) : null}
      </div>

      <div className="os-floor__foot">
        {shown ? (
          <span className="os-row" style={{ gap: '0.9rem' }}>
            <b style={{ color: 'var(--ink)' }}>{prettyDate(shown.day)}</b>
            {DIM_ORDER.map((dim, k) => (
              <span key={dim} className="os-row" style={{ gap: '0.35rem' }}>
                <i aria-hidden="true" style={{ width: 7, height: 7, background: hue(dim), display: 'inline-block' }} />
                {DIMENSIONS[dim].label} {shown.per[k] ? `${shown.per[k]}m` : '—'}
              </span>
            ))}
            {pinned != null ? <span className="os-tag">pinned · click the tile to release</span> : null}
          </span>
        ) : (
          <>
            <span>
              {lit} of {span} days laid · four shards a tile, one per dimension
            </span>
            <span>{span} days ago → today</span>
          </>
        )}
      </div>
    </div>
  );
}

export function FloorLegend() {
  return (
    <div className="os-row" style={{ marginTop: '0.6rem', gap: '1.2rem' }}>
      {DIM_ORDER.map((dim) => (
        <span key={dim} className="os-tag">
          <i
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              marginRight: '0.45em',
              background: hue(dim),
              verticalAlign: '1px',
            }}
          />
          {DIMENSIONS[dim].label}
        </span>
      ))}
      <span className="os-tag" style={{ marginLeft: 'auto' }}>
        shard order: learning · mind · body · success
      </span>
    </div>
  );
}
