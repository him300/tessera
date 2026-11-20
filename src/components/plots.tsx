'use client';

/**
 * A plot per dimension, driven by pointer *or* keyboard.
 *
 *  Learning  a shelf of spines — one session is one book.
 *  Mind      a waveform — amplitude about the axis.
 *  Body      rungs — one rung a session.
 *
 * Press a mark, or focus the plot and use ← → ↑ ↓. Enter pins, Escape releases.
 */

import { useRef, useState, type ReactNode } from 'react';
import { prettyDate } from '@/lib/times';
import type { DimKey } from '@/lib/model';
import { Tip, rectOf, type Anchor } from './Tip';

export type PlotDay = { day: string; minutes: number; lines: string[] };
type Props = { days: PlotDay[]; dim: DimKey };

const W = 900;
const H = 210;
const peakOf = (days: PlotDay[]) => Math.max(1, ...days.map((d) => d.minutes));
const marksOf = (days: PlotDay[]) => days.map((d, i) => ({ d, i })).filter(({ d }) => d.minutes > 0);

/** the panel plus the live line under the plot: two surfaces, one selection */
function Readout({ at, children }: { at: Anchor | null; children: ReactNode }) {
  return <Tip at={at}>{children}</Tip>;
}

function Panel({
  title,
  day,
  pinned,
  value,
  lines,
  hue,
}: {
  title: string;
  day: string;
  pinned: boolean;
  value: string;
  lines: string[];
  hue: string;
}) {
  return (
    <>
      <p className="os-tip__day">
        {prettyDate(day)}
        {pinned ? <em>pinned</em> : null}
      </p>
      <p className="os-tip__row">
        <i aria-hidden="true" style={{ background: hue }} />
        <span>{title}</span>
        <b>{value}</b>
      </p>
      {lines.length ? <p className="os-tip__sum">{lines.join(' · ')}</p> : null}
    </>
  );
}

function Line({ read, fallback }: { read: PlotDay | null; fallback: string }) {
  return (
    <p className="plot-read" aria-live="polite">
      {read ? (
        <>
          <b>{prettyDate(read.day)}</b>
          <span className="plot-read__val">{read.minutes} min</span>
          {read.lines.length ? <span className="plot-read__line">{read.lines.join(' · ')}</span> : null}
        </>
      ) : (
        <span className="plot-read__hint">{fallback}</span>
      )}
    </p>
  );
}

const isArrow = (k: string) => k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowUp';

export function DimensionPlot({ days, dim }: Props) {
  if (dim === 'learning') return <Shelf days={days} dim={dim} />;
  if (dim === 'mind') return <Wave days={days} dim={dim} />;
  if (dim === 'body') return <Ladder days={days} dim={dim} />;
  return null;
}

/* ── learning: a shelf of book spines ────────────────────────────────────── */
function Shelf({ days }: Props) {
  const marks = marksOf(days);
  const peak = peakOf(days);
  const step = (W - 60) / Math.max(1, days.length);
  const w = Math.max(3, step - 2);
  const svg = useRef<SVGSVGElement>(null);

  const [sel, setSel] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const shown = pinned ?? sel;
  const read = shown == null ? null : days[shown];

  const move = (delta: number) => {
    if (!marks.length) return;
    const at = marks.findIndex((m) => m.i === shown);
    const next = at === -1 ? (delta > 0 ? 0 : marks.length - 1) : (at + delta + marks.length) % marks.length;
    const target = marks[next];
    setSel(target.i);
    const g = svg.current?.querySelector<SVGGElement>(`[data-mark="${target.i}"]`);
    if (g) setAnchor(rectOf(g));
  };

  return (
    <div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        tabIndex={0}
        aria-label={`Learning: ${marks.length} sessions. Use the arrow keys to read one.`}
        onKeyDown={(e) => {
          if (isArrow(e.key)) { e.preventDefault(); move(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((p) => (p === shown ? null : shown)); }
          else if (e.key === 'Escape') { setSel(null); setPinned(null); }
        }}
        onBlur={() => setSel(null)}
      >
        <line x1="24" y1={H - 44} x2={W - 24} y2={H - 44} stroke="currentColor" strokeOpacity=".35" />
        {days.map((d, i) => {
          if (!d.minutes) return null;
          const h = 12 + (d.minutes / peak) * (H - 96);
          const x = 30 + i * step;
          return (
            <g
              key={d.day}
              data-mark={i}
              onPointerEnter={(e) => { setSel(i); setAnchor(rectOf(e.currentTarget as unknown as HTMLElement)); }}
              onPointerLeave={() => setSel((s) => (s === i ? null : s))}
              onClick={(e) => { setAnchor(rectOf(e.currentTarget as unknown as HTMLElement)); setPinned((p) => (p === i ? null : i)); }}
              style={{ cursor: 'crosshair' }}
            >
              <rect x={x - 3} y={H - 44 - h} width={w + 6} height={h + 44} fill="transparent" />
              <rect x={x} y={H - 44 - h} width={w} height={h} fill="var(--hue)" opacity={shown === null || shown === i ? 1 : 0.42} />
              <rect x={x} y={H - 44 - h} width={w} height={2} fill="var(--px-hi)" opacity=".75" />
              {pinned === i ? (
                <rect x={x - 2} y={H - 46 - h} width={w + 4} height={h + 2} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
              ) : null}
            </g>
          );
        })}
      </svg>
      {read ? (
        <Readout at={anchor}>
          <Panel title="Learning" day={read.day} pinned={pinned !== null} value={`${read.minutes}m`} lines={read.lines} hue="var(--hue)" />
        </Readout>
      ) : null}
      <Line read={read} fallback="press a spine · or focus the plot and use ← → · enter pins" />
    </div>
  );
}

/* ── mind: a waveform, mirrored about the axis ───────────────────────────── */
function Wave({ days }: Props) {
  const peak = peakOf(days);
  const mid = H / 2;
  const step = (W - 60) / Math.max(1, days.length - 1);
  const pts = days.map((d, i) => ({ x: 30 + i * step, y: mid - (d.minutes / peak) * (mid - 30) }));
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)} L${p.x.toFixed(1)},${(mid + (mid - p.y)).toFixed(1)}`)
    .join(' ');

  const svg = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const shown = pinned ?? sel;
  const read = shown == null ? null : days[shown];

  const anchorAt = (i: number) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({
      left: r.left + (pts[i].x / W) * r.width,
      top: r.top + (pts[i].y / H) * r.height,
      width: 2,
      height: 2,
      bottom: r.top + (pts[i].y / H) * r.height + 2,
    });
  };

  const pick = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    const at = Math.max(0, Math.min(days.length - 1, Math.round((x - 30) / step)));
    setSel(at);
    anchorAt(at);
  };

  const move = (delta: number) => {
    const at = shown == null ? (delta > 0 ? -1 : days.length) : shown;
    const next = (at + delta + days.length) % days.length;
    setSel(next);
    anchorAt(next);
  };

  return (
    <div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        tabIndex={0}
        aria-label="Mind: minutes as a waveform. Use the arrow keys to read a day."
        style={{ cursor: 'crosshair' }}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setSel(null)}
        onKeyDown={(e) => {
          if (isArrow(e.key)) { e.preventDefault(); move(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((p) => (p === shown ? null : shown)); }
          else if (e.key === 'Escape') { setSel(null); setPinned(null); }
        }}
        onBlur={() => setSel(null)}
      >
        <line x1="30" y1={mid} x2={W - 30} y2={mid} stroke="currentColor" strokeOpacity=".3" />
        <path d={d} fill="none" stroke="var(--hue)" strokeWidth="1.4" strokeLinejoin="round" opacity={shown === null ? 1 : 0.55} />
        {shown !== null ? (
          <>
            <line x1={pts[shown].x} y1={20} x2={pts[shown].x} y2={H - 20} stroke="currentColor" strokeOpacity=".45" strokeDasharray="2 3" />
            <circle cx={pts[shown].x} cy={pts[shown].y} r={pinned === shown ? 5 : 3.5} fill="currentColor" />
            <circle cx={pts[shown].x} cy={mid + (mid - pts[shown].y)} r="3.5" fill="currentColor" />
          </>
        ) : null}
      </svg>
      {read ? (
        <Readout at={anchor}>
          <Panel title="Mind" day={read.day} pinned={pinned !== null} value={read.minutes ? `${read.minutes}m` : '—'} lines={read.lines} hue="var(--hue)" />
        </Readout>
      ) : null}
      <Line read={read} fallback="move along the wave · or focus the plot and use ← → · enter pins" />
    </div>
  );
}

/* ── body: rungs, one a session ──────────────────────────────────────────── */
function Ladder({ days }: Props) {
  const marks = marksOf(days);
  const peak = peakOf(days);
  const rowH = Math.min(15, (H - 40) / Math.max(1, marks.length));
  const svg = useRef<SVGSVGElement>(null);

  const [sel, setSel] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const shown = pinned ?? sel;
  const read = shown == null ? null : days[shown];

  const move = (delta: number) => {
    if (!marks.length) return;
    const at = marks.findIndex((m) => m.i === shown);
    const next = at === -1 ? (delta > 0 ? 0 : marks.length - 1) : (at + delta + marks.length) % marks.length;
    const target = marks[next];
    setSel(target.i);
    const g = svg.current?.querySelector<SVGGElement>(`[data-mark="${target.i}"]`);
    if (g) setAnchor(rectOf(g));
  };

  return (
    <div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        tabIndex={0}
        aria-label={`Body: ${marks.length} sessions. Use the arrow keys to read one.`}
        onKeyDown={(e) => {
          if (isArrow(e.key)) { e.preventDefault(); move(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((p) => (p === shown ? null : shown)); }
          else if (e.key === 'Escape') { setSel(null); setPinned(null); }
        }}
        onBlur={() => setSel(null)}
      >
        <line x1="30" y1="14" x2="30" y2={H - 20} stroke="currentColor" strokeOpacity=".3" />
        {marks.map(({ d: day, i }, k) => {
          const len = 40 + (day.minutes / peak) * (W - 160);
          const y = 20 + k * rowH;
          return (
            <g
              key={day.day}
              data-mark={i}
              onPointerEnter={(e) => { setSel(i); setAnchor(rectOf(e.currentTarget as unknown as HTMLElement)); }}
              onPointerLeave={() => setSel((s) => (s === i ? null : s))}
              onClick={(e) => { setAnchor(rectOf(e.currentTarget as unknown as HTMLElement)); setPinned((p) => (p === i ? null : i)); }}
              style={{ cursor: 'crosshair' }}
            >
              <rect x="20" y={y - 2} width={W - 40} height={Math.max(6, rowH)} fill="transparent" />
              <rect x="30" y={y} width={len} height={Math.max(3, rowH - 4)} fill="var(--hue)" opacity={shown === null || shown === i ? 0.95 : 0.35} />
              <rect x="30" y={y} width="3" height={Math.max(3, rowH - 4)} fill="var(--px-hi)" opacity=".85" />
              {pinned === i ? (
                <rect x="27" y={y - 2} width={len + 6} height={Math.max(7, rowH)} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
              ) : null}
            </g>
          );
        })}
      </svg>
      {read ? (
        <Readout at={anchor}>
          <Panel title="Body" day={read.day} pinned={pinned !== null} value={`${read.minutes}m`} lines={read.lines} hue="var(--hue)" />
        </Readout>
      ) : null}
      <Line read={read} fallback="press a rung · or focus the plot and use ↑ ↓ · enter pins" />
    </div>
  );
}
