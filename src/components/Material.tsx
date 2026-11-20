'use client';

/**
 * The material control: one stone in the frame, one drawer, one press.
 *
 * Everything it does is a dataset attribute on <html>. The record's data, its keys,
 * its routes and its store are untouched — only the material changes.
 */

import { useEffect, useRef, useState } from 'react';
import { setPhase, type Phase } from './ThemeBackdrop';
import {
  BITS,
  MATERIALS,
  applyChoice,
  materialById,
  readChoice,
  stone,
  type Bit,
  type Choice,
  type TextMode,
} from '@/lib/materials';

export function Material() {
  const [choice, setChoice] = useState<Choice>({ id: 'ember', bit: 8, text: 'pixel' });
  const [phase, setLocalPhase] = useState<Phase>('dusk');

  /* 16-bit stones blink, everywhere they are shown: the key, and the drawer.
     Lower depths stay still, which is the rule the whole material follows. */
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setFrame((f) => (f ? 0 : 1)), 420);
    return () => window.clearInterval(id);
  }, []);
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);

  // read what the boot script already applied, then stay in sync with other copies
  useEffect(() => {
    setChoice(readChoice());
    try {
      const saved = localStorage.getItem('tessera.phase');
      if (saved === 'dawn' || saved === 'dusk') setLocalPhase(saved);
    } catch {
      /* ignore */
    }
    const sync = () => setChoice(readChoice());
    window.addEventListener('tessera:material', sync as EventListener);
    return () => window.removeEventListener('tessera:material', sync as EventListener);
  }, []);

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const current = materialById(choice.id);

  const choose = (next: Partial<Choice>) => {
    const merged: Choice = { ...choice, ...next };
    setChoice(merged);
    applyChoice(merged);
  };

  return (
    <>
      <button
        className="act matbtn"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span
          className="matbtn__stone"
          aria-hidden="true"
          style={{
            backgroundImage: `url("${stone(current, choice.bit, 4, choice.bit === 16 ? frame : 0, 1)}")`,
            filter: choice.bit === 16 ? `drop-shadow(0 0 6px ${current.levels[2]})` : undefined,
          }}
        />
        <span className="matbtn__name">{current.name}</span>
      </button>

      <dialog
        ref={sheet}
        className="sheet"
        aria-label="Material"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === sheet.current) setOpen(false);
        }}
      >
        <div className="sheet__panel">
          <div className="sheet__head">
            <h2>Material</h2>
            <p>twelve surfaces · four bit depths</p>
            <button className="act" type="button" onClick={() => setOpen(false)} style={{ marginLeft: '1rem' }}>
              Close
            </button>
          </div>

          <div className="materials" role="group" aria-label="Material">
            {MATERIALS.map((m) => (
              <button
                key={m.id}
                type="button"
                className="material"
                aria-pressed={m.id === choice.id}
                onClick={() => choose({ id: m.id, bit: m.bit })}
              >
                <span className="material__bed" style={{ ['--m-bed' as string]: m.bed }}>
                  <img
                    src={stone(m, m.bit, 5, m.bit === 16 ? frame : 0, 1)}
                    alt=""
                    width={34}
                    height={34}
                    style={{
                      imageRendering: 'pixelated',
                      filter: m.bit === 16 ? `drop-shadow(0 0 7px ${m.levels[2]})` : undefined,
                    }}
                  />
                </span>
                <span className="material__name" style={{ ['--m-on' as string]: m.on }}>
                  {m.name}
                </span>
                <span className="material__meta" style={{ ['--m-on' as string]: m.on }}>
                  {m.bit}-bit · {m.tex}
                </span>
              </button>
            ))}
          </div>

          <div className="depthrow" role="group" aria-label="Bit depth">
            <span>depth</span>
            {BITS.map((b) => (
              <button
                key={b}
                type="button"
                className="depthbtn"
                aria-pressed={b === choice.bit}
                onClick={() => choose({ bit: b as Bit })}
              >
                {b}
              </button>
            ))}
            {choice.id === 'sundown' ? (
              <>
                <span style={{ marginLeft: '1.2rem' }}>sun</span>
                {(['dusk', 'dawn'] as Phase[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="textbtn"
                    aria-pressed={p === phase}
                    onClick={() => {
                      setLocalPhase(p);
                      setPhase(p);
                    }}
                  >
                    {p}
                  </button>
                ))}
              </>
            ) : null}
            <span style={{ marginLeft: '1.2rem' }}>text</span>
            {(['pixel', 'read'] as TextMode[]).map((t) => (
              <button
                key={t}
                type="button"
                className="textbtn"
                aria-pressed={t === choice.text}
                onClick={() => choose({ text: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
