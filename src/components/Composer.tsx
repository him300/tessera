'use client';

/**
 * Write on a day.
 *
 * The floor is the calendar, so this opens on a chosen day and a chosen shard: click
 * the top right quarter of a tile and Mind is already selected, with the day in the
 * header. The thing you did is the largest element on screen, because that is the only
 * part you have to think about; the instant, the duration and the reps sit under it as
 * one line of facts you can adjust.
 *
 * It is a native <dialog>: focus is trapped, Escape closes it, focus returns to
 * whatever opened it, all without code of ours.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClock, useNow } from '@/lib/clock';
import { minutes as parseMinutes } from '@/lib/duration';
import { DIMENSIONS, DIM_ORDER, rowKeyOf, type DimKey, type Entry } from '@/lib/model';
import { store, useStore } from '@/lib/store';
import {
  addDays,
  clockNow,
  dateOf,
  dayShort,
  formatMinutes,
  monthName,
  prettyDayDate,
  today as todayFn,
  weekday,
} from '@/lib/times';
import { hue, hueVars } from './ui';

export type ComposeSeed = { dim?: DimKey; date?: string };

/** Open the composer, optionally on a day and a dimension. A bare DimKey still works. */
export const openComposer = (seed?: DimKey | ComposeSeed) =>
  window.dispatchEvent(
    new CustomEvent<DimKey | ComposeSeed | undefined>('tessera:compose', { detail: seed }),
  );

const pad = (n: number) => String(n).padStart(2, '0');

const FIELDS: Record<DimKey, { label: string; placeholder: string; reps?: boolean }> = {
  learning: { label: 'Book and page', placeholder: 'The Quiet Machine, 13 to 20' },
  mind: { label: 'Style', placeholder: 'Focused Attention' },
  body: { label: 'Exercise', reps: true, placeholder: 'Leg Up Burpees And Tricep Dips' },
  success: { label: 'Action taken', placeholder: 'YouTube Upload, Market, First Pitch' },
};

const isDim = (v: unknown): v is DimKey => DIM_ORDER.includes(v as DimKey);

export function Composer() {
  const ref = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const today = useNow();
  const clock = useClock();
  const { entries, role } = useStore();
  const readOnly = role === 'view';

  const [dim, setDim] = useState<DimKey>('body');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [sec, setSec] = useState(0);
  const [duration, setDuration] = useState('');
  const [text, setText] = useState('');
  const [reps, setReps] = useState('');
  const [touched, setTouched] = useState(false);

  /**
   * The default instant for a day: now, if it is today. For a day already behind us,
   * the last row that day plus a minute, so a second entry sits beside the first
   * instead of on top of it; and noon if the day is empty.
   */
  const defaultTime = useCallback(
    (day: string, d: DimKey) => {
      if (day === todayFn()) {
        const [hh, mm] = clockNow().split(':').map(Number);
        return { h: hh, m: mm, s: 0 };
      }
      // A 00:00 placeholder is not something that happened, so it does not set the
      // clock: the first real row of a past day defaults to noon.
      const rows = entries
        .filter((e) => e.dim === d && dateOf(e.at) === day && e.origin !== 'topup')
        .sort((a, b) => (a.at < b.at ? -1 : 1));
      const last = rows[rows.length - 1];
      if (last) {
        const [hh, mm, ss] = last.at.slice(11, 19).split(':').map(Number);
        const total = Math.min(hh * 3600 + mm * 60 + ss + 60, 23 * 3600 + 59 * 60 + 59);
        return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
      }
      return { h: 12, m: 0, s: 0 };
    },
    [entries],
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<DimKey | ComposeSeed | undefined>).detail;
      const seed: ComposeSeed = isDim(detail) ? { dim: detail } : (detail ?? {});

      const nextDim = seed.dim ?? 'body';
      const nextDate = seed.date && seed.date <= todayFn() ? seed.date : todayFn();
      const time = defaultTime(nextDate, nextDim);

      setDim(nextDim);
      setDate(nextDate);
      setMonth(nextDate.slice(0, 7));
      setH(time.h);
      setM(time.m);
      setSec(time.s);
      setDuration('');
      setText('');
      setReps('');
      setTouched(false);

      const el = ref.current;
      if (el && !el.open) el.showModal();
      // The content is the point, so the caret lands there, not on the calendar.
      window.setTimeout(() => field.current?.focus({ preventScroll: true }), 60);
    };
    window.addEventListener('tessera:compose', onOpen);
    return () => window.removeEventListener('tessera:compose', onOpen);
  }, [defaultTime]);

  const minutes = parseMinutes(duration);
  const at = `${date}T${pad(h)}:${pad(m)}:${pad(sec)}`;

  /** Which dimensions already hold a row on the chosen day, and how many. */
  const dayRows = useMemo(() => {
    const map = new Map<DimKey, number>();
    for (const e of entries) {
      if (dateOf(e.at) !== date) continue;
      map.set(e.dim, (map.get(e.dim) ?? 0) + 1);
    }
    return map;
  }, [entries, date]);

  const inherit = useMemo(() => {
    const prior = [...entries]
      .filter((e) => e.dim === dim && e.at <= at)
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    return prior?.fields ?? null;
  }, [entries, dim, at]);

  const ordinal = useMemo(
    () => entries.filter((e) => e.dim === dim && e.at === at).length,
    [entries, dim, at],
  );

  const save = useCallback(() => {
    const timeText = minutes != null ? formatMinutes(minutes) : text.trim() || 'Nothing';
    const compact = minutes == null ? '0' : String(minutes);
    const carry = (key: string, fallback: string) => {
      const v = (inherit?.[key] ?? '').trim();
      return v || fallback;
    };

    const fields: Record<string, string> =
      dim === 'learning'
        ? {
            Time_Allocated: minutes != null ? timeText : 'Nothing',
            Book_and_Page: text.trim() || '(nothing,nothing)',
          }
        : dim === 'mind'
          ? {
              'Time Allocated': minutes != null ? timeText : 'Nothing',
              'Meditation-Style': text.trim() || 'None',
            }
          : dim === 'body'
            ? {
                Time_Allocated: minutes != null ? timeText : 'Nothing',
                Exercise: text.trim() || 'None',
                Number_Of_Reps: reps.trim() || 'NaN',
                SubGoal: carry('SubGoal', 'Build A Steady Practice'),
                'State Of SubGoal': carry('State Of SubGoal', compact),
              }
            : {
                Time_Allocated: minutes != null ? timeText : 'Nothing',
                Action_Took: text.trim() || 'Nothing',
                SubGoal: carry('SubGoal', 'Ship One Small Thing Each Week'),
                'State Of SubGoal': carry('State Of SubGoal', compact),
              };

    const entry: Entry = {
      rowKey: rowKeyOf(dim, at, ordinal),
      dim,
      at,
      minutes,
      fields,
      ordinal,
      origin: 'user',
    };
    store.append(entry, `Laid on ${prettyDayDate(date)}`);
    setTouched(false);
    ref.current?.close();
  }, [at, date, dim, inherit, minutes, ordinal, reps, text]);

  /** The strip under the content: a fortnight around the chosen day, today at most. */
  const strip = useMemo(() => {
    const end = today;
    const days: string[] = [];
    for (let i = 13; i >= 0; i -= 1) days.push(addDays(end, -i));
    const chosen = days.includes(date) ? days : [...days.slice(1), date].sort();
    return chosen;
  }, [date, today]);

  const cells = useMemo(() => {
    const [y, mo] = month.split('-').map(Number);
    const firstOfMonth = `${month}-01`;
    const lead = (weekday(firstOfMonth) + 6) % 7;
    const start = addDays(firstOfMonth, -lead);
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i);
      return { date: d, inMonth: d.slice(0, 7) === month, num: Number(d.slice(8, 10)), y, m: mo };
    });
  }, [month]);

  const shiftMonth = (n: number) => {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  const goDay = (n: number) => {
    const next = addDays(date, n);
    if (next > todayFn()) return;
    setDate(next);
    setMonth(next.slice(0, 7));
    const time = defaultTime(next, dim);
    setH(time.h);
    setM(time.m);
    setSec(time.s);
  };

  const chooseDay = (next: string) => {
    if (next > todayFn()) return;
    setDate(next);
    const time = defaultTime(next, dim);
    setH(time.h);
    setM(time.m);
    setSec(time.s);
  };

  const f = FIELDS[dim];
  const canSave =
    !readOnly && Boolean(date) && date <= todayFn() && h >= 0 && h < 24 && m >= 0 && m < 60 && sec >= 0 && sec < 60;
  const earlier = dayRows.get(dim) ?? 0;

  return (
    <dialog ref={ref} className="write" aria-labelledby="write-title" style={hueVars(dim)}>
      <form
        className="write__inner"
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (canSave) save();
        }}
      >
        <div className="write__head">
          <div className="write__when">
            <span className="label">{dayShort(date)}</span>
            <h2 id="write-title" className="write__day">
              {prettyDayDate(date)}
            </h2>
          </div>
          <div className="write__nav">
            <button className="iconbtn" type="button" onClick={() => goDay(-1)} aria-label="Previous day">
              ←
            </button>
            <button
              className="iconbtn"
              type="button"
              onClick={() => chooseDay(todayFn())}
              aria-label="Today"
              data-on={date === today ? 'true' : undefined}
            >
              today
            </button>
            <button
              className="iconbtn"
              type="button"
              onClick={() => goDay(1)}
              aria-label="Next day"
              disabled={date >= today}
            >
              →
            </button>
            <button className="iconbtn" type="button" onClick={() => ref.current?.close()} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="write__strip">
          <span className="label">Day</span>
          <div className="write__days" role="group" aria-label="Pick a day">
            {strip.map((d) => (
              <button
                key={d}
                type="button"
                className="write__daychip"
                data-sel={d === date ? 'true' : undefined}
                aria-pressed={d === date}
                aria-label={prettyDayDate(d)}
                onClick={() => chooseDay(d)}
              >
                {Number(d.slice(8, 10))}
              </button>
            ))}
          </div>
          <details className="write__more">
            <summary className="label">Another month</summary>
            <div className="cal">
              <div className="cal__head">
                <span className="cal__month">
                  {monthName(Number(month.slice(5, 7)))} {month.slice(0, 4)}
                </span>
                <span className="cal__nav">
                  <button className="iconbtn" type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    ←
                  </button>
                  <button className="iconbtn" type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
                    →
                  </button>
                </span>
              </div>
              <div className="cal__grid" role="group" aria-label="Date">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span className="cal__dow" key={i}>
                    {d}
                  </span>
                ))}
                {cells.map((c) => (
                  <button
                    key={c.date}
                    type="button"
                    className="cal__day"
                    data-out={c.inMonth ? undefined : 'true'}
                    data-sel={c.date === date ? 'true' : undefined}
                    disabled={c.date > todayFn()}
                    aria-pressed={c.date === date}
                    aria-label={c.date}
                    onClick={() => chooseDay(c.date)}
                  >
                    {c.num}
                  </button>
                ))}
              </div>
            </div>
          </details>
        </div>

        <div className="write__body">
          <div className="write__main">
            <div className="dimpick">
              <div className="dimpick__tile" aria-hidden="true">
                {DIM_ORDER.map((d) => (
                  <i
                    key={d}
                    data-on={d === dim ? 'true' : undefined}
                    data-has={(dayRows.get(d) ?? 0) > 0 ? 'true' : undefined}
                    style={{ '--hue': hue(d) } as React.CSSProperties}
                  />
                ))}
              </div>
              <div className="dimpick__names" role="group" aria-label="Dimension">
                {DIM_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === dim}
                    onClick={() => {
                      setDim(d);
                      setText('');
                      setReps('');
                      const time = defaultTime(date, d);
                      setH(time.h);
                      setM(time.m);
                      setSec(time.s);
                    }}
                  >
                    <i style={{ '--hue': hue(d) } as React.CSSProperties} aria-hidden="true" />
                    {DIMENSIONS[d].label}
                    {dayRows.get(d) ? <em className="dimpick__count">{dayRows.get(d)}</em> : null}
                  </button>
                ))}
              </div>
            </div>

            <label className="write__field">
              <span className="label">{f.label}</span>
              <input
                ref={field}
                className="write__input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={f.placeholder}
                aria-describedby="write-hint"
                autoComplete="off"
              />
              <span className="write__rule" aria-hidden="true" />
            </label>
          </div>

          <div className="write__facts">
            <div className="timeline">
              <label className="timefield">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={pad(h)}
                  aria-label="Hour"
                  onChange={(e) => setH(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                />
                <span>hour</span>
              </label>
              <span className="timecolon" aria-hidden="true">
                :
              </span>
              <label className="timefield">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={pad(m)}
                  aria-label="Minute"
                  onChange={(e) => setM(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                />
                <span>min</span>
              </label>
              <span className="timecolon" aria-hidden="true">
                :
              </span>
              <label className="timefield">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={pad(sec)}
                  aria-label="Second"
                  onChange={(e) => setSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                />
                <span>sec</span>
              </label>
              <button
                className="iconbtn"
                type="button"
                onClick={() => {
                  const [hh, mm] = clock.split(':').map(Number);
                  setH(hh);
                  setM(mm);
                  setSec(0);
                }}
              >
                now
              </button>
            </div>

            <label className="write__fact">
              <span className="label">Duration</span>
              <input
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="20 · 1h 15m · 82.33mins"
                aria-describedby="write-hint"
              />
              <em className="write__unit" data-ok={minutes != null ? 'true' : undefined}>
                {duration.trim() === ''
                  ? 'nothing recorded'
                  : minutes == null
                    ? 'not a duration yet'
                    : formatMinutes(minutes)}
              </em>
            </label>

            {f.reps ? (
              <label className="write__fact">
                <span className="label">Reps</span>
                <input
                  className="input"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="175"
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="write__foot">
          {readOnly ? (
            <p className="hint" data-kind="error">
              This key can read the record but not write to it. Nothing here will be saved.
            </p>
          ) : (
            <button className="btn" type="submit">
              Lay the row
            </button>
          )}
          <p id="write-hint" className="hint" data-kind={!readOnly && touched && !canSave ? 'error' : undefined}>
            {!readOnly && touched && !canSave
              ? 'That instant is not a real time.'
              : `${DIMENSIONS[dim].tab} · ${at.replace('T', ' ')} · ${
                  minutes != null ? formatMinutes(minutes) : 'Nothing'
                }${earlier ? ` · ${earlier} already on this day` : ''}`}
          </p>
        </div>
      </form>
    </dialog>
  );
}
