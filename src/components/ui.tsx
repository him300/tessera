/**
 * The small pieces every page shares. Server-safe: no hooks, no browser APIs.
 *
 * The one repeated mark is a tile divided into four shards, in the order the
 * workbook lists them: learning, mind, body, success.
 */

import type { CSSProperties, ReactNode } from 'react';
import { DIM_ORDER, type DimKey } from '@/lib/model';

/** The four smalti are CSS custom properties, so a theme can change them. */
export const hue = (dim: DimKey) => `var(--c-${dim})`;
export const hueInk = (dim: DimKey) => `var(--i-${dim})`;

/** The four custom properties that colour a block for one dimension. */
export function hueVars(dim: DimKey): CSSProperties {
  return {
    '--hue': hue(dim),
    '--hue-ink': hueInk(dim),
    '--hue-soft': `color-mix(in srgb, var(--c-${dim}) 11%, transparent)`,
    '--hue-soft-2': `color-mix(in srgb, var(--c-${dim}) 42%, transparent)`,
  } as CSSProperties;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`label${className ? ' ' + className : ''}`}>{children}</span>;
}

export function Figure({ value, unit, hue }: { value: ReactNode; unit?: string; hue?: DimKey }) {
  return (
    <p className="figure" style={hue ? { color: hueInk(hue) } : undefined}>
      {value}
      {unit ? <small>{unit}</small> : null}
    </p>
  );
}

/** A 2x2 mark with one shard lit: the dimension, not the record. */
export function ShardMark({ dim, on = false }: { dim: DimKey; on?: boolean }) {
  return (
    <span className="index__mark" aria-hidden="true" style={hueVars(dim)}>
      {DIM_ORDER.map((d) => (
        <i key={d} data-on={d === dim && on ? 'true' : undefined} style={{ '--hue': hue(d) } as CSSProperties} />
      ))}
    </span>
  );
}

export function Bulb({ dim, healthy }: { dim: DimKey; healthy: boolean }) {
  return (
    <span
      className="light__bulb"
      aria-hidden="true"
      data-healthy={healthy ? 'true' : 'false'}
      style={{ '--hue': hue(dim) } as CSSProperties}
    />
  );
}
