'use client';

/**
 * Shape: the four courses on one axis, as windows.
 *
 * A range, four lanes of days, one sentence, and where the minutes actually went.
 * The plot belongs to the tab, not to the page — this one compares.
 */

import { useMemo, useRef, useState } from 'react';
import { useNow } from '@/lib/clock';
import { DIMENSIONS, DIM_ORDER } from '@/lib/model';
import { useStore } from '@/lib/store';
import { activeSeries, consistency, summary, recordTotals } from '@/lib/stats';
import { addDays, dateOf, daysBetween, formatMinutes, prettyDate, shortDate } from '@/lib/times';
import { hue, hueVars } from './ui';
import { Tip, rectOf, type Anchor } from './Tip';

type RangeKey = '28' | '84' | '180' | '365' | 'all';

const RANGES: Array<{ key: RangeKey; days: number | null; n: string; unit: string }> = [
  { key: '28', days: 28, n: '28', unit: 'days' },
  { key: '84', days: 84, n: '84', unit: 'days' },
  { key: '180', days: 180, n: '180', unit: 'days' },
  { key: '365', days: 365, n: '365', unit: 'days' },
  { key: 'all', days: null, n: 'all', unit: 'record' },
];


/** one course's days: hover reads, click pins — the same gesture as the floor */
function Lane({
  dim,
  days,
}: {
  dim: (typeof DIM_ORDER)[number];
  days: Array<{ day: string; minutes: number; lines: string[] }>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const shownIndex = pinned ?? hover;
  const shown = shownIndex == null ? null : days[shownIndex];

  const point = (el: HTMLElement) => setAnchor(rectOf(el));

  return (
    <div ref={wrap} className="lane-wrap">
      <div className="os-strip" style={{ ...hueVars(dim) } as React.CSSProperties}>
        {days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className="lane-cell"
            data-on={d.minutes > 0 ? '' : undefined}
            data-pinned={pinned === i ? '1' : undefined}
            aria-pressed={pinned === i}
            aria-label={`${prettyDate(d.day)}: ${d.minutes ? `${d.minutes} minutes` : 'nothing'}`}
            onPointerEnter={(e) => {
              setHover(i);
              point(e.currentTarget);
            }}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={(e) => {
              setHover(i);
              point(e.currentTarget);
            }}
            onBlur={() => setHover((h) => (h === i ? null : h))}
            onClick={(e) => {
              point(e.currentTarget);
              setPinned((p) => (p === i ? null : i));
            }}
          />
        ))}
      </div>

      {shown ? (
        <Tip at={anchor}>
          <div>
          <p className="os-tip__day">
            {prettyDate(shown.day)}
            {pinned != null ? <em>pinned</em> : null}
          </p>
          <p className="os-tip__row">
            <i aria-hidden="true" style={{ background: hue(dim) }} />
            <span>{DIMENSIONS[dim].label}</span>
            <b>{shown.minutes ? `${shown.minutes}m` : '—'}</b>
          </p>
          {shown.lines.length ? <p className="os-tip__sum">{shown.lines.join(' · ')}</p> : null}
          </div>
        </Tip>
      ) : null}
    </div>
  );
}

export function ShapeView() {
  const { entries } = useStore();
  const today = useNow();
  const [range, setRange] = useState<RangeKey>('84');

  const chosen = RANGES.find((r) => r.key === range) ?? RANGES[1];
  const first = useMemo(() => {
    const dates = entries.map((e) => e.at.slice(0, 10)).sort();
    return dates[0] ?? today;
  }, [entries, today]);

  /* a window can ask for more days than the record has held: never charge the record
     for days that predate its first row */
  const asked = chosen.days ?? Math.max(1, daysBetween(first, today) + 1);
  const earliest = addDays(today, -(asked - 1));
  const from = earliest < first ? first : earliest;
  const span = daysBetween(from, today) + 1;

  const lanes = useMemo(
    () =>
      DIM_ORDER.map((dim) => {
        const list = entries.filter((e) => e.dim === dim);
        const s = summary(list, today);
        const shownDays = Math.min(span, 120);
        const byDay = new Map<string, { minutes: number; lines: string[] }>();
        list.forEach((e) => {
          if (e.minutes == null) return;
          const day = dateOf(e.at);
          const cell = byDay.get(day) ?? { minutes: 0, lines: [] };
          cell.minutes += e.minutes;
          const line = DIMENSIONS[dim].line(e.fields);
          if (line && cell.lines.length < 1) cell.lines.push(line);
          byDay.set(day, cell);
        });
        const days = Array.from({ length: shownDays }, (_, i) => {
          const day = addDays(today, -(shownDays - 1 - i));
          const cell = byDay.get(day);
          return { day, minutes: cell?.minutes ?? 0, lines: cell?.lines ?? [] };
        });
        return {
          dim,
          total: s.totalMinutes,
          active: s.activeDays,
          pct: Math.round(consistency(list, from, today) * 100),
          days,
        };
      }),
    [entries, from, today, span],
  );

  const ranked = [...lanes].sort((a, b) => b.pct - a.pct);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const totals = recordTotals(entries, today);
  const most = Math.max(1, ...lanes.map((l) => l.total));

  return (
    <main className="os-screen">
      <div className="os-screen__head">
        <h1>Shape</h1>
        <span className="os-tag">screen 3 of 5 · 4 dimensions on one axis</span>
      </div>

      <div className="os-wins">
        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>Range</span>
            <span>active days ÷ calendar days</span>
          </div>
          <div className="os-win__body">
            <div className="os-row" role="group" aria-label="Range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className="os-chip"
                  aria-pressed={range === r.key}
                  onClick={() => setRange(r.key)}
                >
                  {r.n} {r.unit}
                </button>
              ))}
            </div>
            <p className="os-mono" style={{ marginTop: '0.8rem', maxWidth: '62ch' }}>
              A day counts when a row for that dimension carries a duration, so the 00:00
              placeholders never do.
            </p>
          </div>
        </section>

        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>Four lanes</span>
            <span>
              {chosen.days
                ? span < asked
                  ? `${span} of ${chosen.n} days · the record starts ${shortDate(first)}`
                  : `last ${chosen.n} ${chosen.unit}`
                : `the whole record · ${span} days`}
            </span>
          </div>
          <div className="os-win__body">
            {lanes.map((lane) => (
              <div
                key={lane.dim}
                style={{
                  ...hueVars(lane.dim),
                  display: 'grid',
                  gridTemplateColumns: '96px 1fr 62px',
                  gap: '0.9rem',
                  alignItems: 'center',
                  padding: '0.45rem 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <span className="os-tag" style={{ color: 'var(--hue)' }}>
                  <i style={{ display: 'inline-block', width: 8, height: 8, marginRight: '.5em', background: hue(lane.dim) }} />
                  {DIMENSIONS[lane.dim].label}
                </span>
                <Lane dim={lane.dim} days={lane.days} />
                <span className="os-course__num" style={{ color: 'var(--ink)' }}>
                  {lane.pct}%
                </span>
              </div>
            ))}
            <div className="os-floor__foot" style={{ marginTop: '0.5rem' }}>
              <span>{shortDate(from)}</span>
              <span>today</span>
            </div>
          </div>
        </section>

        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>Where the minutes went</span>
            <span>every row in the record</span>
          </div>
          <div className="os-win__body">
            {lanes.map((lane) => (
              <div
                key={lane.dim}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '96px 1fr 92px',
                  gap: '0.9rem',
                  alignItems: 'center',
                  padding: '0.35rem 0',
                }}
              >
                <span className="os-tag">{DIMENSIONS[lane.dim].label}</span>
                <div style={{ display: 'grid', gridAutoFlow: 'column', gap: 2 }}>
                  {Array.from({ length: 28 }, (_, i) => {
                    const filled = lane.total / most > i / 28;
                    return (
                      <i
                        key={i}
                        style={{
                          height: 12,
                          background: filled ? hue(lane.dim) : 'color-mix(in srgb, var(--ink) 10%, var(--ground))',
                          boxShadow: filled ? 'inset 1px 1px 0 color-mix(in srgb, white 45%, transparent)' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
                <span className="os-course__num" style={{ color: 'var(--ink)' }}>
                  {formatMinutes(lane.total)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>The sentence</span>
            <span>{totals.rows} rows</span>
          </div>
          <div className="os-win__body">
            <p className="display" style={{ fontSize: 'clamp(1.3rem, 2.4vw, 2rem)', maxWidth: '34ch' }}>
              {strongest.pct === weakest.pct ? (
                <>All 4 dimensions hold the same shape over {span} days: {strongest.pct}% of them were active.</>
              ) : (
                <>
                  <span style={{ color: hue(strongest.dim) }}>{DIMENSIONS[strongest.dim].label}</span> holds the
                  line at {strongest.pct}%, while{' '}
                  <span style={{ color: hue(weakest.dim) }}>{DIMENSIONS[weakest.dim].label}</span> keeps{' '}
                  {weakest.pct}% of the same {span} days.
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
