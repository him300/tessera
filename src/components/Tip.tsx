'use client';

/**
 * The readout panel, portalled to <body>.
 *
 * Windows clip and stack, so a panel living inside one gets cut by the next. This
 * renders outside the layout entirely and positions itself against the anchor's
 * viewport rect: above the tile, or below it when there is no room up there, and
 * never past the edge of the screen.
 */

import { createPortal } from 'react-dom';

export type Anchor = { left: number; top: number; width: number; height: number; bottom: number };

export function rectOf(el: Element): Anchor {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom };
}

export function Tip({ at, children }: { at: Anchor | null; children: React.ReactNode }) {
  if (!at || typeof document === 'undefined') return null;

  const half = 110;
  const left = Math.min(Math.max(at.left + at.width / 2, half), Math.max(half, window.innerWidth - half));
  const flip = at.top < 130;
  const top = flip ? at.bottom + 8 : at.top - 8;

  return createPortal(
    <div className="os-tip" data-flip={flip ? '1' : undefined} style={{ left, top }} role="status">
      {children}
    </div>,
    document.body,
  );
}
