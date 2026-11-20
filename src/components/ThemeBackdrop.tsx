'use client';

/**
 * The scene: two materials earn a full-bleed background — Lamplit (the night street)
 * and Sundown (the pixel sunset). If the artwork is present in /public/materials it is
 * used as-is; if not, a drawn fallback holds the frame so the material is never bare.
 *
 * Sundown carries a second variable the others do not: the sun's direction. Dusk runs
 * magenta to gold, dawn inverts the ramp and lifts the light.
 */

import { useEffect, useState } from 'react';
import { materialById, readChoice } from '@/lib/materials';

export type Phase = 'dawn' | 'dusk';
const PHASE_KEY = 'tessera.phase';

const SCENE: Record<string, { label: string; file: string }> = {
  lamplit: { label: 'Lamplit', file: '/materials/lamplit.jpg' },
  sundown: { label: 'Sundown', file: '/materials/sundown.jpg' },
};

export function ThemeBackdrop() {
  const [material, setMaterial] = useState('ember');
  const [phase, setPhase] = useState<Phase>('dusk');
  const [hasArt, setHasArt] = useState(false);

  useEffect(() => {
    let stored: Phase = 'dusk';
    try {
      const v = localStorage.getItem(PHASE_KEY);
      if (v === 'dawn' || v === 'dusk') stored = v;
    } catch {
      /* private mode */
    }
    setPhase(stored);
    setMaterial(readChoice().id);

    const onMaterial = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      setMaterial(detail?.id ?? readChoice().id);
    };
    const onPhase = (e: Event) => {
      const detail = (e as CustomEvent<{ phase: Phase }>).detail;
      setPhase(detail.phase);
    };
    window.addEventListener('tessera:material', onMaterial);
    window.addEventListener('tessera:phase', onPhase);
    return () => {
      window.removeEventListener('tessera:material', onMaterial);
      window.removeEventListener('tessera:phase', onPhase);
    };
  }, []);

  const scene = SCENE[material];

  // the shell reads this to go translucent over the artwork
  useEffect(() => {
    const root = document.documentElement;
    if (scene) {
      root.dataset.scene = material;
      root.dataset.phase = scene && material === 'sundown' ? phase : '';
    } else {
      delete root.dataset.scene;
      delete root.dataset.phase;
    }
    setHasArt(false);
  }, [material, phase, scene]);

  if (!scene) return null;

  const m = materialById(material);

  return (
    <div className="os-scene" data-material={material} data-phase={phase} aria-hidden="true">
      {/* the drawn fallback: a horizon, a sun and a warm floor of light */}
      <div className="os-scene__drawn">
        <span className="os-scene__sun" />
        <span className="os-scene__horizon" />
        <span className="os-scene__glow" />
      </div>

      {/* the artwork, if it has been dropped in */}
      <img
        className="os-scene__art"
        src={scene.file}
        alt=""
        data-loaded={hasArt ? 'true' : 'false'}
        onLoad={() => setHasArt(true)}
        onError={() => setHasArt(false)}
        style={{ objectPosition: material === 'sundown' && phase === 'dawn' ? 'center 20%' : 'center' }}
      />

      <div className="os-scene__grain" />
      <div className="os-scene__scrim" style={{ ['--scene-bed' as string]: m.bed }} />
    </div>
  );
}

/** the phase switch, rendered by the material drawer when Sundown is chosen */
export function setPhase(phase: Phase) {
  try {
    localStorage.setItem(PHASE_KEY, phase);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent<{ phase: Phase }>('tessera:phase', { detail: { phase } }));
}
