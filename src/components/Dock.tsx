'use client';

/**
 * The dock: depth, text resolution, and the machine's status strip. It writes the
 * same two attributes the material drawer writes, so the two controls agree.
 */

import { useEffect, useState } from 'react';
import { BITS, applyChoice, materialById, readChoice, type Bit, type Choice, type TextMode } from '@/lib/materials';
import { useClock } from '@/lib/clock';

export function Dock() {
  const [choice, setChoice] = useState<Choice>({ id: 'ember', bit: 8, text: 'pixel' });
  const clock = useClock();

  useEffect(() => {
    setChoice(readChoice());
    const sync = () => setChoice(readChoice());
    window.addEventListener('tessera:material', sync as EventListener);
    return () => window.removeEventListener('tessera:material', sync as EventListener);
  }, []);

  const set = (next: Partial<Choice>) => {
    const merged = { ...choice, ...next };
    setChoice(merged);
    applyChoice(merged);
  };

  const m = materialById(choice.id);

  return (
    <>
      <div className="os-dockbar">
        <div className="os-dockbar__group">
          <span className="os-dockbar__label">depth</span>
          {BITS.map((b) => (
            <button
              key={b}
              type="button"
              className="os-chip"
              aria-pressed={b === choice.bit}
              onClick={() => set({ bit: b as Bit })}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="os-dockbar__group">
          <span className="os-dockbar__label">text</span>
          {(['pixel', 'read'] as TextMode[]).map((t) => (
            <button
              key={t}
              type="button"
              className="os-chip"
              aria-pressed={t === choice.text}
              onClick={() => set({ text: t })}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="os-dockbar__group" style={{ marginLeft: 'auto' }}>
          <span className="os-dockbar__label">material</span>
          <span className="os-chip" aria-hidden="true">{m.name}</span>
        </div>
      </div>

      <div className="os-status">
        <span>{m.name} · {choice.bit}-bit · {m.tex} · text {choice.text}</span>
        <span>{clock} JHB · append only</span>
      </div>
    </>
  );
}
