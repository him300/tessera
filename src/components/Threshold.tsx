'use client';

/**
 * The threshold.
 *
 * A mosaic floor has a doorway, and a doorway has a threshold course: the line of
 * tiles you step over to be inside. Here that course is the key. Each character seats
 * one tile, from the last slot backwards, on the same curve the floor settles on. A key
 * that opens the record floods the course with the four smalti and the curtain lifts
 * onto the floor. A key that does not turns the course the colour of a missing day and
 * says so in one sentence.
 *
 * The tiles are decoration: the field, its label and the status line are the interface.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/engine';
import { useClock } from '@/lib/clock';
import { store, useStore } from '@/lib/store';

const SLOTS = 24;
const COURSE = Array.from({ length: SLOTS }, (_, i) => i);

type Note = { kind: 'error' | 'note'; text: string } | null;

export function Threshold() {
  const state = useStore();
  const clock = useClock();
  const router = useRouter();

  const [key, setKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [sealed, setSealed] = useState(false);
  const [refused, setRefused] = useState(false);

  const course = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const seated = useRef(0);

  const open = state.store === 'open';
  const readOnly = open && state.role === 'view';
  const local = state.store === 'local';
  const held = state.unsynced.length;
  const taken = open ? SLOTS : Math.min(key.length, SLOTS);

  // Seat the tile that just arrived. One tween, on the one clock; a delete simply
  // leaves the bed, because a tile is never pulled out of a threshold in a hurry.
  useEffect(() => {
    const grew = taken > seated.current;
    const index = taken - 1;
    seated.current = taken;
    if (!grew || prefersReducedMotion()) return;
    const tile = course.current?.querySelectorAll<HTMLElement>('.threshold__slot')[index];
    if (!tile) return;
    gsap.killTweensOf(tile);
    gsap.fromTo(
      tile,
      { scale: 0.24, yPercent: 26 },
      { scale: 1, yPercent: 0, duration: 0.42, ease: 'power4.out', overwrite: true },
    );
  }, [taken]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const value = key.trim();
    if (!value) {
      setNote({ kind: 'error', text: 'Enter the key first, then open the floor.' });
      field.current?.focus();
      return;
    }

    setBusy(true);
    setNote(null);
    const result = await store.unlock(value);
    setBusy(false);

    if (result.status === 'open') {
      const rows = result.entries.length;
      setNote({
        kind: 'note',
        text: rows
          ? `Open. ${rows === 1 ? 'One row was' : `${rows} rows were`} already on the floor, and everything this browser held has been written to it.`
          : 'Open. Nothing was waiting on the floor, and this browser is ready to write.',
      });
      setSealed(true);
      // Let the course finish flooding before the curtain lifts.
      window.setTimeout(() => router.push('/'), prefersReducedMotion() ? 0 : 900);
      return;
    }

    if (result.status === 'locked') {
      setNote({ kind: 'error', text: 'That key does not open this record.' });
      setRefused(true);
      window.setTimeout(() => setRefused(false), 720);
      field.current?.select();
      return;
    }

    setNote({ kind: 'error', text: result.error });
  };

  const seal = () => {
    store.seal();
    setKey('');
    seated.current = 0;
    setSealed(false);
    setNote({ kind: 'note', text: 'Sealed. The record is untouched, and this browser holds no key.' });
  };

  return (
    <section className="threshold wrap" aria-labelledby="threshold-h">
      <div className="threshold__body">
        <div className="threshold__lede">
          {open ? (
            <>
              <h1 id="threshold-h" className="display threshold__title">
                The floor is <em>{readOnly ? 'open to read.' : 'open.'}</em>
              </h1>
              {readOnly ? (
                <p className="lede">
                  This browser holds a viewing key. Every page is readable and nothing is
                  writable: the composer will say so rather than pretend to save.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h1 id="threshold-h" className="display threshold__title">
                Lay the key. <em>Step onto the floor.</em>
              </h1>
              <p className="lede">
                The record has a threshold now. One key, entered once in this browser, and every row
                you type is written to the floor itself instead of to this tab alone.
              </p>
              <p className="prose threshold__prose">
                The key is checked by the server and never stored. What this browser keeps is a
                cookie, good for thirty days, which you can seal again at any time. Until then every
                page of the record answers to it.
              </p>
            </>
          )}
        </div>

        <div className="threshold__gate">
          {open ? (
            <div className="threshold__act">
              <Link className="btn" href="/">
                Go to the floor
              </Link>
              <button className="btn btn--ghost" type="button" onClick={seal}>
                Seal this browser
              </button>
            </div>
          ) : (
            <form className="gate" onSubmit={submit} noValidate>
              <label className="label" htmlFor="tessera-key">
                Key
              </label>

              <div className="gate__row">
                <input
                  ref={field}
                  id="tessera-key"
                  className="gate__input"
                  type={reveal ? 'text' : 'password'}
                  name="key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="the key you set for this record"
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="tessera-key-hint tessera-key-status"
                  aria-invalid={note?.kind === 'error' ? true : undefined}
                  disabled={busy}
                />
                <button
                  className="gate__peek"
                  type="button"
                  aria-pressed={reveal}
                  onClick={() => setReveal((v) => !v)}
                >
                  {reveal ? 'Hide' : 'Show'}
                </button>
              </div>

              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Opening' : 'Open the floor'}
              </button>

              <p className="gate__hint" id="tessera-key-hint">
                {local
                  ? 'This build has no server record, so rows stay in this browser.'
                  : 'Checked on the server. This browser keeps a cookie, never the key.'}
              </p>
            </form>
          )}

          <p
            className="gate__note"
            id="tessera-key-status"
            data-kind={note?.kind ?? undefined}
            role={note?.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {note?.text ??
              (open
                ? 'The record is open in this browser.'
                : local
                  ? 'No server record is configured on this build.'
                  : 'Not opened yet in this browser.')}
          </p>
        </div>
      </div>

      <dl className="threshold__facts">
        <div>
          <dt>Record</dt>
          <dd>{readOnly ? 'open, read only' : statusWord(state.store)}</dd>
        </div>
        <div>
          <dt>Held here</dt>
          <dd>
            {held} {held === 1 ? 'row' : 'rows'}
          </dd>
        </div>
        <div>
          <dt>On the floor</dt>
          <dd>{open ? state.storeTotal : '·'}</dd>
        </div>
        <div>
          <dt>Clock</dt>
          <dd>{clock} JHB</dd>
        </div>
      </dl>

      {/* The threshold itself: one tile per character, the line you step over. */}
      <div className="threshold__sill">
        <p className="threshold__gauge mono" aria-hidden="true">
          <span>Threshold</span>
          <span className="threshold__gauge-rule" />
          <span>
            {String(taken).padStart(2, '0')}/{SLOTS} laid
          </span>
        </p>
        <div
          className="threshold__slots"
          ref={course}
          data-sealed={open || sealed ? 'true' : undefined}
          data-refused={refused ? 'true' : undefined}
          aria-hidden="true"
        >
          {COURSE.map((i) => (
            <span
              key={i}
              className="threshold__slot"
              data-set={i < taken ? 'true' : undefined}
              data-dim={i % 4}
              style={{ '--i': i } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function statusWord(value: ReturnType<typeof useStore>['store']): string {
  switch (value) {
    case 'open':
      return 'open';
    case 'locked':
      return 'locked';
    case 'local':
      return 'local only';
    case 'offline':
      return 'unreachable';
    default:
      return 'checking';
  }
}
