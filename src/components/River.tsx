'use client';

/**
 * The eight-week plot: one band whose width is minutes.
 *
 * No bars. The curve is a monotone cubic through the eight real values — smooth,
 * but it passes exactly through each week and cannot overshoot into a minute that
 * never happened. A week at zero pinches the band shut, and the spine keeps the date
 * so the absence is drawn rather than missing.
 *
 * Colours come from the material's tokens, so the plot re-skins with the record.
 */

import { useMemo, useRef, useState } from 'react';

type Props = {
  weeks: number[];
  labels: string[];
  height?: number;
};

const W = 640;
const PAD_X = 22;

/* monotone cubic (Fritsch–Carlson): smooth, no overshoot, passes through every point */
function interpolate(xs: number[], ys: number[]) {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));

  const m = new Array<number>(n);
  m[0] = d[0] ?? 0;
  m[n - 1] = d[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i += 1) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;

  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }

  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i += 1;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

export function River({ weeks, labels, height = 190 }: Props) {
  const [probe, setProbe] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  /* a long window carries many weeks: thin the labels so they never collide */
  const n = weeks.length;
  const every = Math.max(1, Math.ceil(n / 9));
  const showValues = n <= 12;

  const H = height;
  const padTop = 26;
  const padBot = 30;
  const cy = (padTop + (H - padBot)) / 2 + 4;
  const maxHW = Math.min(34, (H - padTop - padBot) / 2);

  const { d, spine, xs, hw, max } = useMemo(() => {
    const n = weeks.length;
    const maxV = Math.max(...weeks, 1);
    const xsIn = weeks.map((_, i) => PAD_X + (i * (W - PAD_X * 2)) / (n - 1));
    const hwIn = weeks.map((v) => (v / maxV) * maxHW);
    const f = interpolate(xsIn, hwIn);

    const steps = 140;
    const top: Array<[number, number]> = [];
    const bottom: Array<[number, number]> = [];
    for (let s = 0; s <= steps; s += 1) {
      const x = PAD_X + (s / steps) * (W - PAD_X * 2);
      const h = Math.max(0.6, f(x));
      top.push([x, cy - h]);
      bottom.push([x, cy + h]);
    }

    const path =
      `M${top.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} ` +
      `L${bottom.reverse().map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} Z`;

    return {
      d: path,
      spine: `M${xsIn[0].toFixed(1)},${cy} L${xsIn[n - 1].toFixed(1)},${cy}`,
      xs: xsIn,
      hw: hwIn,
      max: maxV,
    };
  }, [weeks, cy, maxHW]);

  const pick = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    let best = 0;
    let bestD = Infinity;
    xs.forEach((px, i) => {
      const dist = Math.abs(px - x);
      if (dist < bestD) {
        bestD = dist;
        best = i;
      }
    });
    setProbe(best);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const at = probe == null ? (e.key === 'ArrowRight' ? -1 : weeks.length) : probe;
    const next = (at + (e.key === 'ArrowRight' ? 1 : -1) + weeks.length) % weeks.length;
    setProbe(next);
  };

  const read = probe == null ? null : { label: labels[probe], value: weeks[probe] };
  const maxWeek = Math.max(...weeks);

  return (
    <div className="river">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`Weekly minutes across ${weeks.length} weeks: ${weeks
          .map((v, i) => `${labels[i]} ${v ? `${v} minutes` : 'not kept'}`)
          .join(', ')}.`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setProbe(null)}
        onFocus={() => setProbe((p) => (p == null ? weeks.length - 1 : p))}
        onBlur={() => setProbe(null)}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id="riverfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".8" />
            <stop offset="46%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent-ink, var(--accent))" stopOpacity=".95" />
          </linearGradient>
        </defs>

        {/* the section markers: this is a slice of a longer record */}
        <g stroke="var(--accent)" strokeOpacity=".65">
          <line x1={PAD_X} y1={cy - maxHW - 7} x2={PAD_X} y2={cy + maxHW + 7} />
          <line x1={W - PAD_X} y1={cy - maxHW - 7} x2={W - PAD_X} y2={cy + maxHW + 7} />
        </g>

        <path d={d} fill="url(#riverfill)" stroke="var(--accent)" strokeOpacity=".45" strokeWidth="1" />
        <path d={spine} stroke="currentColor" strokeOpacity=".26" strokeWidth="1" strokeDasharray="1 3" />

        {showValues && weeks.map((v, i) =>
          v ? (
            <text
              key={`v${i}`}
              x={xs[i]}
              y={cy - hw[i] - 8}
              textAnchor="middle"
              fontFamily="var(--f-mono)"
              fontSize="9"
              fill="currentColor"
              opacity=".75"
            >
              {v}
            </text>
          ) : null,
        )}

        {weeks.map((v, i) => (
          <text
            key={`d${i}`}
            x={xs[i]}
            y={H - 8}
            textAnchor="middle"
            fontFamily="var(--f-mono)"
            fontSize="8"
            letterSpacing="1"
            fill="currentColor"
            opacity={i % every === 0 || i === n - 1 ? (probe === i ? 0.95 : 0.45) : 0}
          >
            {labels[i].toUpperCase()}
          </text>
        ))}

        {probe != null ? (
          <g aria-hidden="true">
            <line
              x1={xs[probe]}
              y1={12}
              x2={xs[probe]}
              y2={H - padBot + 4}
              stroke="currentColor"
              strokeOpacity=".4"
              strokeDasharray="2 3"
            />
            <circle cx={xs[probe]} cy={cy - hw[probe]} r="3.4" fill="currentColor" />
          </g>
        ) : null}
      </svg>

      <p className="river__read" aria-live="polite">
        {read ? (
          <>
            <b>{read.label}</b> · {read.value ? `${read.value} min` : 'not kept'}
          </>
        ) : (
          <>
            {n} weeks · <b>{weeks.reduce((sum, v) => sum + v, 0)} min</b> ·{' '}
            {weeks.filter((v) => v === 0).length} empty
          </>
        )}
      </p>

      <p className="river__note">
        width is minutes · a zero week pinches the band shut · heaviest {maxWeek} min
      </p>
    </div>
  );
}
