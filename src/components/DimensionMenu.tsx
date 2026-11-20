'use client';

/**
 * One key for the four dimensions. The drawer is not a list of links: each row is a
 * card carrying that dimension's hue, its minutes, its active days and the last
 * thirty days as a strip. It answers the pointer and the keyboard, and it wears the
 * material like everything else.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DIMENSIONS, DIM_ORDER } from '@/lib/model';
import { useStore } from '@/lib/store';
import { useNow } from '@/lib/clock';
import { activeSeries, consistency, summary } from '@/lib/stats';
import { addDays, formatMinutes } from '@/lib/times';
import { hue } from './ui';

export function DimensionMenu() {
  const path = usePathname();
  const { entries } = useStore();
  const today = useNow();
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const active = DIM_ORDER.find((d) => path === `/dimension/${d}`);
  const from = addDays(today, -29);

  return (
    <>
      <button
        type="button"
        className="os-navlink"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={{
          fontFamily: 'var(--f-fix)',
          fontSize: '0.5625rem',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          padding: '0.55em 0.7em',
          color: 'var(--muted)',
          boxShadow: 'inset 0 0 0 2px var(--line)',
        }}
      >
        {active ? DIMENSIONS[active].label : 'Dimension'} ▾
      </button>

      <dialog ref={sheet} className="sheet" aria-label="Dimensions" onClose={() => setOpen(false)}>
        <div className="sheet__panel dimpanel">
          <div className="dimpanel__head">
            <div>
              <p className="os-tag">the record, by dimension</p>
              <h2 className="dimpanel__title">4 dimensions</h2>
            </div>
            <button className="os-key" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <div className="dimpanel__list">
            {DIM_ORDER.map((dim, k) => {
              const list = entries.filter((e) => e.dim === dim);
              const s = summary(list, today);
              const pct = Math.round(consistency(list, from, today) * 100);
              const strip = activeSeries(list, today, 30);
              return (
                <Link
                  key={dim}
                  href={`/dimension/${dim}`}
                  className="dimcard"
                  style={{ ['--hue' as string]: hue(dim) }}
                  onClick={() => setOpen(false)}
                >
                  <span className="dimcard__n">{String(k + 1).padStart(2, '0')}</span>
                  <span className="dimcard__body">
                    <span className="dimcard__name">{DIMENSIONS[dim].label}</span>
                    <span className="dimcard__strip" aria-hidden="true">
                      {strip.map((v, i) => (
                        <i key={i} data-on={v ? '' : undefined} />
                      ))}
                    </span>
                  </span>
                  <span className="dimcard__figures">
                    <b>{formatMinutes(s.totalMinutes)}</b>
                    <span>
                      {s.activeDays} days · {pct}% of 30
                    </span>
                  </span>
                  <span className="dimcard__go" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              );
            })}
          </div>

          <p className="dimpanel__foot">
            one tile, four shards — learning · mind · body · success
          </p>
        </div>
      </dialog>
    </>
  );
}
