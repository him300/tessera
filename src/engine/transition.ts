// Page transitions. The adapter runs leave() while the next page loads, so a
// transition adds little or no latency.
//
// The look belongs to the concept: a course of tiles is laid over the page from the
// bottom up, then lifted from the page underneath. Gaps between tiles show the ink
// plane behind them, so no part of the old page is ever visible through the mortar.
import { gsap } from 'gsap';
import { ease, prefersReducedMotion } from './env';

export type Transition = {
  leave: (curtain: HTMLElement) => Promise<unknown> | gsap.core.Animation;
  enter: (curtain: HTMLElement) => Promise<unknown> | gsap.core.Animation;
};

const tiles = (c: HTMLElement) => c.querySelectorAll<HTMLElement>('.tile-fill');

const current: Transition = {
  leave: (c) => {
    const panel = c.querySelector('.curtain__panel') as HTMLElement;
    const t = Array.from(tiles(c));
    return gsap
      .timeline()
      .set(c, { autoAlpha: 1 })
      .fromTo(panel, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: ease.inOut })
      .fromTo(
        t,
        { scale: 0.24, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.42, ease: ease.set, stagger: { each: 0.006, from: 'end' } },
        0.1,
      );
  },
  enter: (c) => {
    const panel = c.querySelector('.curtain__panel') as HTMLElement;
    const t = Array.from(tiles(c));
    return gsap
      .timeline()
      .to(t, { scale: 0.24, opacity: 0, duration: 0.3, ease: 'power2.in', stagger: { each: 0.004, from: 'start' } })
      .to(panel, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.62, ease: ease.inOut }, 0.08)
      .set(c, { autoAlpha: 0 });
  },
};

const reduced: Transition = {
  leave: (c) => gsap.timeline().set(c, { autoAlpha: 1 }).fromTo(c, { opacity: 0 }, { opacity: 1, duration: 0.18 }),
  enter: (c) => gsap.timeline().to(c, { autoAlpha: 0, duration: 0.18 }),
};

export const setTransition = (t: Transition) => {
  current.leave = t.leave;
  current.enter = t.enter;
};

const pick = () => (prefersReducedMotion() ? reduced : current);
const curtain = () => document.getElementById('curtain') as HTMLElement;

export const playLeave = () => Promise.resolve(pick().leave(curtain()));
export const playEnter = () => Promise.resolve(pick().enter(curtain()));

export { current as defaultTransition };
