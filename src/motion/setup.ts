// Global motion, registered once on the client before the first page initializes.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { onPage, prefersReducedMotion, setTransition } from '@/engine';
import { startIdle } from './idle';

gsap.registerPlugin(ScrollTrigger);

export function setupMotion() {
  startIdle();
  // The curtain is authored in engine/transition.ts; nothing global to override here.
  setTransition({
    leave: (c) =>
      gsap
        .timeline()
        .set(c, { autoAlpha: 1 })
        .fromTo(
          c.querySelector('.curtain__panel'),
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'expo.inOut' },
        )
        .fromTo(
          Array.from(c.querySelectorAll('.tile-fill')),
          { scale: 0.24, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.42, ease: 'power4.out', stagger: { each: 0.006, from: 'end' } },
          0.1,
        ),
    enter: (c) =>
      gsap
        .timeline()
        .to(Array.from(c.querySelectorAll('.tile-fill')), {
          scale: 0.24,
          opacity: 0,
          duration: 0.3,
          ease: 'power2.in',
          stagger: { each: 0.004, from: 'start' },
        })
        .to(c.querySelector('.curtain__panel'), { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.62, ease: 'expo.inOut' }, 0.08)
        .set(c, { autoAlpha: 0 }),
  });

  // The floor's raking light is the only thing that moves at rest.
  onPage(() => {
    const floor = document.querySelector<HTMLElement>('[data-floor]');
    if (!floor || prefersReducedMotion()) return;
    return startRake(floor);
  });
}

function startRake(floor: HTMLElement) {
  const rake = floor.querySelector<HTMLElement>('.floor__rake');
  if (!rake) return;
  const x = gsap.quickTo(rake, 'x', { duration: 1.1, ease: 'power2.out' });
  const y = gsap.quickTo(rake, 'y', { duration: 1.1, ease: 'power2.out' });
  const r = { x: 0, y: 0 };
  const move = (e: PointerEvent) => {
    const box = floor.getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width - 0.5;
    const py = (e.clientY - box.top) / box.height - 0.5;
    r.x = px * box.width * 0.55;
    r.y = py * box.height * 0.9;
    x(r.x);
    y(r.y);
  };
  floor.addEventListener('pointermove', move, { passive: true });
  floor.addEventListener('pointerleave', () => {
    r.x = 0;
    r.y = 0;
    x(0);
    y(0);
  });
  // Idle: one slow light travelling the floor, so the record keeps breathing while
  // nothing is touched. The pointer adds to it, it never replaces it.
  const drift = () => {
    if (!document.body.contains(floor)) return;
    const box = floor.getBoundingClientRect();
    if (box.bottom < -300 || box.top > window.innerHeight + 300) return;
    const t = gsap.ticker.time;
    rake.style.setProperty('--rake-x', `${(Math.sin(t * 0.24) * 0.5 - 0.5) * 46}%`);
    rake.style.setProperty('--rake-y', `${Math.sin(t * 0.13) * 9}%`);
  };
  gsap.ticker.add(drift);
  return () => {
    floor.removeEventListener('pointermove', move);
    gsap.ticker.remove(drift);
  };
}
