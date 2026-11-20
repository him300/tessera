/** Media queries and the one easing vocabulary. Never invent a per-component curve. */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isTouch = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches;

export const isMobile = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches;

export const ease = {
  out: 'expo.out',
  inOut: 'expo.inOut',
  soft: 'power3.out',
  /** the tile settling into its bed: fast down, no bounce */
  set: 'power4.out',
} as const;
