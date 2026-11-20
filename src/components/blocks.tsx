'use client';

/**
 * The record's blocks, rebuilt on the shell: readouts, courses, the stone rack, the
 * river, the sheet, the last rows. Every one of them reads the store, so a row added
 * anywhere is a row counted everywhere.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { RULES } from '@/data/site';
import { useNow } from '@/lib/clock';
import { check } from '@/lib/health';
import { DIMENSIONS, DIM_ORDER, type DimKey, type Entry } from '@/lib/model';
import { useStore } from '@/lib/store';
import {
  activeSeries,
  consistency,
  recordTotals,
  summary,
  weeklyMinutes,
} from '@/lib/stats';
import { addDays, dateOf, formatMinutes, ledgerStamp, mondayOf, prettyDate, shortDate } from '@/lib/times';

const daysAgo = (today: string, n: number) => addDays(today, -n);
import { River } from './River';
import { useRange } from '@/lib/range';
import { materialById, stone, useMaterialChoice } from '@/lib/materials';
import { DIM_RANGES, dimRange, spanDays, useDimRange } from '@/lib/dimRange';
import { DimensionPlot, type PlotDay } from './plots';
import { Tip, rectOf, type Anchor } from './Tip';
import { hue, hueVars } from './ui';

const rowsOf = (entries: Entry[], dim: DimKey) => entries.filter((e) => e.dim === dim);

/** minutes per day for the last n days, in order, today last */
function dailyMinutes(list: Entry[], today: string, days: number): number[] {
  const byDay = new Map<string, number>();
  list.forEach((e) => {
    if (e.minutes == null) return;
    const d = dateOf(e.at);
    byDay.set(d, (byDay.get(d) ?? 0) + e.minutes);
  });
  return Array.from({ length: days }, (_, i) => byDay.get(addDays(today, -(days - 1 - i))) ?? 0);
}

const level = (m: number) => (m === 0 ? 0 : m <= 4 ? 1 : m <= 9 ? 2 : m <= 19 ? 3 : m <= 29 ? 4 : 5);

/* ── the record at a glance ───────────────────────────────────────────────── */

export function RecordFacts({ wide = false }: { wide?: boolean }) {
  const { entries } = useStore();
  const today = useNow();
  const days = useRange();

  /* the same window the floor is showing, so the numbers above it agree */
  const windowed = useMemo(() => {
    const from = days === 0 ? null : addDays(today, -(days - 1));
    const list = from ? entries.filter((e) => dateOf(e.at) >= from) : entries;
    const real = list.filter((e) => e.minutes != null);
    return {
      rows: list.length,
      daysLaid: new Set(real.map((e) => dateOf(e.at))).size,
      minutes: real.reduce((n, e) => n + (e.minutes ?? 0), 0),
    };
  }, [entries, today, days]);

  const cells = [
    ['Rows', String(windowed.rows)],
    ['Days laid', String(windowed.daysLaid)],
    ['Minutes kept', windowed.minutes.toLocaleString('en-GB')],
  ];

  return (
    <>
    <div className="os-stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
      {cells.map(([label, value]) => (
        <div className="os-stat" key={label}>
          <span className="os-tag">{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
    <p className="os-mono" style={{ marginTop: '0.5rem' }}>
      {days === 0 ? 'the whole record' : `the last ${days} days`} · rows, days laid and minutes over that window
    </p>
    </>
  );
}

/** four courses, each with its own hue, minutes and a day-per-cell strip */
export function Courses() {
  const { entries } = useStore();
  const today = useNow();
  const wanted = useRange();
  /* the strip is the same window the floor is showing, capped so the cells stay legible */
  const stripSpan = Math.min(60, spanDays(entries, today, wanted));

  return (
    <div>
      {DIM_ORDER.map((dim) => {
        const list = rowsOf(entries, dim);
        const s = summary(list, today);
        const series = activeSeries(list, today, stripSpan);
        return (
          <Link
            className="os-course"
            key={dim}
            href={`/dimension/${dim}`}
            style={{ ...hueVars(dim), color: 'inherit' } as CSSProperties}
          >
            <i className="os-course__dot" aria-hidden="true" />
            <span className="os-course__name">{DIMENSIONS[dim].label}</span>
            <span className="os-course__num">{formatMinutes(s.totalMinutes)}</span>
            <span className="os-course__num">{s.activeDays} days</span>
            <div className="os-strip" aria-hidden="true">
              {series.map((v, i) => (
                <i key={i} data-on={v ? '' : undefined} />
              ))}
            </div>
            <span className="os-course__stamp">{s.lastAt ? ledgerStamp(s.lastAt, today) : '·'}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function LatestRows({ count = 6 }: { count?: number }) {
  const { entries } = useStore();
  const today = useNow();
  const rows = [...entries]
    .filter((e) => e.minutes != null)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, count);

  return (
    <table className="os-table">
      <thead>
        <tr>
          <th scope="col">Instant</th>
          <th scope="col">Dimension</th>
          <th scope="col">Row</th>
          <th scope="col" style={{ textAlign: 'right' }}>
            Figure
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.rowKey}>
            <td>{ledgerStamp(e.at, today)}</td>
            <td>
              <span style={{ color: hue(e.dim) }}>▪</span> {DIMENSIONS[e.dim].label}
            </td>
            <td>{DIMENSIONS[e.dim].line(e.fields)}</td>
            <td className="num">{DIMENSIONS[e.dim].figure(e.fields, e.minutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Four lights, one per dimension. The headline is the consistency figure over the
 * window the floor is showing — the same number the Shape page prints — with the
 * audit's issue count kept as a footnote rather than as the whole story.
 */
export function Lights({ compact = false }: { compact?: boolean }) {
  const { entries } = useStore();
  const today = useNow();
  const wanted = useRange();
  const span = spanDays(entries, today, wanted);
  const from = daysAgo(today, span - 1);

  return (
    <div className="os-grid2">
      {DIM_ORDER.map((dim) => {
        const list = rowsOf(entries, dim);
        const report = check(dim, list);
        const pct = Math.round(consistency(list, from, today) * 100);
        const activeInWindow = list.filter((e) => e.minutes != null && dateOf(e.at) >= from).length;

        return (
          <div key={dim} style={hueVars(dim)}>
            <p className="os-row" style={{ justifyContent: 'space-between', gap: '0.6rem' }}>
              <span className="os-tag" style={{ color: 'var(--hue)' }}>
                {DIMENSIONS[dim].label}
              </span>
              <b className="lights__pct">{pct}%</b>
            </p>
            <p className="os-mono" style={{ marginTop: '0.15rem' }}>
              consistency · last {span} days
            </p>
            <p className="os-mono" style={{ marginTop: '0.3rem' }}>
              {report.rows} rows · {activeInWindow} in window
            </p>
            {!compact && report.issues.length ? (
              <p className="os-mono" style={{ marginTop: '0.15rem', color: 'var(--accent)' }}>
                audit · {report.issues.length} to review
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RulesBlock() {
  const { entries } = useStore();
  const audit = DIM_ORDER.map((d) => check(d, rowsOf(entries, d)));
  const duplicates = audit.reduce((n, r) => n + r.issues.filter((i) => i.kind === 'duplicate').length, 0);
  const gaps = audit.reduce((n, r) => n + r.issues.filter((i) => i.kind === 'gap').length, 0);
  const sheetRows = entries.filter((e) => e.origin === 'sheet').length;
  const filled = entries.filter((e) => e.origin === 'topup').length;

  const stat: Record<string, string> = {
    append: `${sheetRows} rows read, 0 rewritten`,
    duplicate: duplicates === 0 ? 'no duplicate row found' : `${duplicates} duplicate row${duplicates === 1 ? '' : 's'} found`,
    day: gaps === 0 ? `${filled} days filled at 00:00, no hole left` : `${gaps} days still missing a row`,
    clock: 'Africa/Johannesburg, UTC+2, no conversion',
  };

  return (
    <div className="os-rule-list">
      {RULES.map((rule, i) => (
        <div key={rule.key}>
          <b>{String(i + 1).padStart(2, '0')}</b>
          <div>
            <strong>{rule.title}</strong>
            <p>{rule.body}</p>
            <p className="os-mono" style={{ marginTop: '0.3em' }}>{stat[rule.key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── one course, in full ──────────────────────────────────────────────────── */

export function DimensionStats({ dim }: { dim: DimKey }) {
  const { entries } = useStore();
  const today = useNow();
  const s = summary(rowsOf(entries, dim), today);

  const cells: Array<[string, string, string, string]> = [
    ['Kept in all', s.totalMinutes.toLocaleString('en-GB'), 'min', `${s.activeDays} active days`],
    ['Streak', String(s.streak), s.streak === 1 ? 'day' : 'days', `longest ${s.longest}`],
    ['Consistency', String(Math.round(s.consistency * 100)), '%', 'last 60 days'],
    [
      'Last entry',
      s.lastAt ? ledgerStamp(s.lastAt, today) : '·',
      '',
      `${s.totalEntries} rows with a duration`,
    ],
  ];

  return (
    <div className="os-stats" style={hueVars(dim)}>
      {cells.map(([label, value, unit, note]) => (
        <div className="os-stat" key={label}>
          <span className="os-tag">{label}</span>
          <b>
            {value}
            {unit ? <small style={{ marginLeft: '0.28em' }}>{unit}</small> : null}
          </b>
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

export const PLOT_STYLE: Record<DimKey, string> = {
  learning: 'spines · one session, one book',
  mind: 'waveform · amplitude about the axis',
  body: 'rungs · one rung a session',
  success: 'river · width is minutes',
};

/** one window control, shared by the plot and the stones */
export function DimRangeChips() {
  const wanted = useDimRange();
  return (
    <div className="os-row" role="group" aria-label="Days shown" style={{ marginBottom: '0.7rem' }}>
      <span className="os-tag">days</span>
      {DIM_RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          className="os-chip"
          aria-pressed={wanted === r.days}
          onClick={() => dimRange.set(r.days)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** the presence window, titled by whatever range is chosen */
export function PresenceWindow({ dim }: { dim: DimKey }) {
  const { entries } = useStore();
  const today = useNow();
  const wanted = useDimRange();
  const span = spanDays(entries, today, wanted);

  return (
    <section className="os-win os-win--wide">
      <div className="os-win__bar">
        <span>Presence · {span} days</span>
        <span>one stone per day</span>
      </div>
      <div className="os-win__body">
        <DimensionDays dim={dim} />
      </div>
    </section>
  );
}

/** the plot that fits this tab's data, with the values behind every mark */
export function DimensionPlotWindow({ dim }: { dim: DimKey }) {
  const { entries } = useStore();
  const today = useNow();
  const wanted = useDimRange();
  const list = rowsOf(entries, dim);
  const span = spanDays(entries, today, wanted);

  const days = useMemo<PlotDay[]>(() => {
    const byDay = new Map<string, { minutes: number; lines: string[] }>();
    list.forEach((e) => {
      if (e.minutes == null) return;
      const day = dateOf(e.at);
      const cell = byDay.get(day) ?? { minutes: 0, lines: [] };
      cell.minutes += e.minutes;
      const line = DIMENSIONS[dim].line(e.fields);
      if (line && !cell.lines.includes(line) && cell.lines.length < 2) cell.lines.push(line);
      byDay.set(day, cell);
    });
    return Array.from({ length: span }, (_, i) => {
      const day = addDays(today, -(span - 1 - i));
      const cell = byDay.get(day);
      return { day, minutes: cell?.minutes ?? 0, lines: cell?.lines ?? [] };
    });
  }, [list, dim, today, span]);

  if (dim === 'success') {
    const weeks = Math.max(2, Math.ceil(span / 7));
    const series = weeklyMinutes(list, today, weeks);
    const labels = series.map((_, i) => shortDate(addDays(mondayOf(today), -7 * (weeks - 1 - i))));
    return (
      <div style={hueVars(dim) as CSSProperties}>
        <DimRangeChips />
        <River weeks={series} labels={labels} />
      </div>
    );
  }

  return (
    <div style={hueVars(dim) as CSSProperties}>
      <DimRangeChips />
      <DimensionPlot days={days} dim={dim} />
    </div>
  );
}

/** the eight weeks, as the river */
export function WeekCourses({ dim }: { dim: DimKey }) {
  const { entries } = useStore();
  const today = useNow();
  const weeks = weeklyMinutes(rowsOf(entries, dim), today, 8);
  const labels = weeks.map((_, i) => shortDate(addDays(mondayOf(today), -7 * (weeks.length - 1 - i))));

  return <River weeks={weeks} labels={labels} />;
}

/**
 * Presence: ninety days, one stone a day. A stone is lit when that day carries a row
 * with a duration — the 00:00 rows the top-up lays are rows, not activity, so they
 * stay cold. The panel rides the stone, and a click pins it.
 */
type PresenceDay = {
  day: string;
  minutes: number;
  active: boolean;
  level: number;
  lines: string[];
  origin: string;
};

export function DimensionDays({ dim }: { dim: DimKey }) {
  const { entries } = useStore();
  const today = useNow();
  const wanted = useDimRange();
  const span = spanDays(entries, today, wanted);
  const [at, setAt] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  /* the stones are the material's own pixel art; only 16-bit gets the blink */
  const choice = useMaterialChoice();
  const mat = materialById(choice.id);
  const animated = choice.bit === 16;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animated) {
      setFrame(0);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setFrame((f) => (f ? 0 : 1)), 420);
    return () => window.clearInterval(id);
  }, [animated]);

  const days = useMemo<PresenceDay[]>(() => {
    const byDay = new Map<string, { minutes: number; lines: string[]; origin: string; active: boolean }>();
    rowsOf(entries, dim).forEach((e) => {
      const day = dateOf(e.at);
      const cell = byDay.get(day) ?? { minutes: 0, lines: [], origin: 'sheet', active: false };
      const real = e.minutes != null;
      cell.active = cell.active || real;
      cell.minutes += e.minutes ?? 0;
      if (real) cell.origin = e.origin;
      const line = DIMENSIONS[dim].line(e.fields);
      if (line && !cell.lines.includes(line) && cell.lines.length < 2) cell.lines.push(line);
      byDay.set(day, cell);
    });

    return Array.from({ length: span }, (_, i) => {
      const day = addDays(today, -(span - 1 - i));
      const cell = byDay.get(day);
      const minutes = cell?.minutes ?? 0;
      return {
        day,
        minutes,
        active: cell?.active ?? false,
        level: cell?.active ? level(minutes) || 1 : 0,
        lines: cell?.lines ?? [],
        origin: cell?.origin ?? '',
      };
    });
  }, [entries, dim, today, span]);

  const lit = days.filter((d) => d.active).length;
  const heaviest = Math.max(0, ...days.map((d) => d.minutes));

  /* a pin beats a pointer, exactly like the floor */
  const shownIndex = pinned ?? at;
  const read = shownIndex == null ? null : days[shownIndex];

  const point = (el: HTMLElement) => setAnchor(rectOf(el));

  const step = (delta: number) => {
    const from = shownIndex == null ? (delta > 0 ? -1 : days.length) : shownIndex;
    const next = (from + delta + days.length) % days.length;
    setAt(next);
    setPinned(null);
    setAnchor(null);
  };

  return (
    <div
      className="presence"
      data-at={at == null ? undefined : '1'}
      tabIndex={0}
      role="group"
      aria-label={`Presence, ${span} days: ${lit} of ${span} active. Use the arrow keys to read a day.`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          step(-1);
        } else if (e.key === 'Escape') {
          setAt(null);
          setPinned(null);
        }
      }}
      onBlur={() => setAt(null)}
      style={hueVars(dim) as CSSProperties}
    >
      <DimRangeChips />
      <div className="presence__grid" onPointerLeave={() => setAt(null)}>
        {days.map((d, i) => (
          <i
            key={d.day}
            className={d.level ? 'presence__stone presence__stone--sprite' : 'presence__stone'}
            data-lv={d.level || undefined}
            data-at={shownIndex === i ? '1' : undefined}
            data-pinned={pinned === i ? '1' : undefined}
            style={{
              ['--d' as string]: i,
              backgroundImage: d.level ? `url("${stone(mat, choice.bit, d.level, frame, i % 5)}")` : undefined,
              filter:
                animated && d.level
                  ? `drop-shadow(0 0 5px ${mat.levels[2]})`
                  : d.level
                    ? 'drop-shadow(0 1px 0 rgb(0 0 0 / .45))'
                    : undefined,
            } as CSSProperties}
            onPointerEnter={(e) => {
              setAt(i);
              point(e.currentTarget);
            }}
            onClick={(e) => {
              point(e.currentTarget);
              setPinned((p) => (p === i ? null : i));
            }}
            onPointerDown={(e) => point(e.currentTarget)}
          />
        ))}
      </div>

      {read ? (
        <Tip at={anchor}>
          <p className="os-tip__day">
            {prettyDate(read.day)}
            {pinned != null ? <em>pinned</em> : null}
          </p>
          <p className="os-tip__row">
            <i aria-hidden="true" style={{ background: 'var(--hue)' }} />
            <span>{DIMENSIONS[dim].label}</span>
            <b>{read.active ? `${read.minutes}m` : '—'}</b>
          </p>
          {read.lines.length ? <p className="os-tip__sum">{read.lines.join(' · ')}</p> : null}
          {read.active && read.origin === 'topup' ? (
            <p className="os-tip__sum">laid at 00:00</p>
          ) : null}
        </Tip>
      ) : null}

      <p className="presence__read" aria-live="polite">
        {read ? (
          <>
            <b>{prettyDate(read.day)}</b>
            <em className={read.active ? 'presence__val' : 'presence__val presence__val--cold'}>
              {read.active ? `${read.minutes} min` : 'no row'}
            </em>
            {read.lines.length ? <span className="presence__line">{read.lines.join(' · ')}</span> : null}
            {pinned != null ? <span className="presence__tag">pinned · click the stone to release</span> : null}
          </>
        ) : (
          <>
            <span className="presence__hint">point at a stone · or tab here and use ← →</span>
            <span className="presence__meta">
              {lit} of {span} active · heaviest {heaviest} min
            </span>
          </>
        )}
      </p>

      <div className="presence__axis">
        <span>{span} days ago</span>
        <span>{lit} of {span} days active</span>
        <span>today</span>
      </div>
    </div>
  );
}

export function DimensionSheet({ dim }: { dim: DimKey }) {
  const { entries } = useStore();
  const report = check(dim, rowsOf(entries, dim));

  return (
    <div className="os-plate">
      <div className="os-plate__bar">
        <span>Sheet · {DIMENSIONS[dim].tab}</span>
        <span>{report.healthy ? 'healthy' : `${report.issues.length} to review`}</span>
      </div>
      <div className="os-plate__body">
        <p className="os-mono">
          {report.rows} rows · {report.activeDays} active days · {report.spanDays} days in span
        </p>
        <p className="os-mono" style={{ marginTop: '0.4em' }}>
          columns {DIMENSIONS[dim].columns.join(', ')}
        </p>
        {report.issues.length ? (
          <ul style={{ marginTop: '0.7em', display: 'grid', gap: '0.25em' }}>
            {report.issues.slice(0, 4).map((issue, i) => (
              <li className="os-mono" key={i}>
                <b style={{ color: 'var(--accent)' }}>{issue.kind}</b> · {issue.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="os-mono" style={{ marginTop: '0.7em' }}>
            ordered, complete, nothing repeats
          </p>
        )}
      </div>
    </div>
  );
}

export function DimensionRows({ dim, count = 8 }: { dim: DimKey; count?: number }) {
  const { entries } = useStore();
  const today = useNow();
  const rows = rowsOf(entries, dim)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, count);

  return (
    <table className="os-table">
      <thead>
        <tr>
          <th scope="col">Instant</th>
          <th scope="col">Row</th>
          <th scope="col" style={{ textAlign: 'right' }}>
            Figure
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.rowKey}>
            <td>
              {dateOf(e.at) === today
                ? e.at.slice(11, 16)
                : `${prettyDate(dateOf(e.at))} ${e.at.slice(11, 16)}`}
            </td>
            <td>{DIMENSIONS[dim].line(e.fields)}</td>
            <td className="num">{e.minutes == null ? '' : DIMENSIONS[dim].figure(e.fields, e.minutes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
