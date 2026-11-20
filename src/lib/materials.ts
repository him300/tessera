/**
 * The material: Tessera's appearance, as data.
 *
 * A material is a ground, an ink, an accent and a five-step stone ramp. Choosing one
 * writes four attributes on <html> (material, bit, text, plus the token block in
 * theme.css does the rest), so every component keeps reading the same CSS variables
 * it always read. Nothing in the record knows a material exists.
 */

import { useSyncExternalStore } from 'react';

export type Bit = 2 | 4 | 8 | 16;
export type TextMode = 'pixel' | 'read';

export type Material = {
  id: string;
  name: string;
  bit: Bit;
  tex: string;
  bed: string;
  on: string;
  accent: string;
  hi: string;
  levels: [string, string, string, string, string];
  note: string;
};

export const MATERIALS: Material[] = [
  { id: 'ember', name: 'Ember', bit: 8, tex: 'dither', bed: '#160f0d', on: '#efe7db', accent: '#b6462a', hi: '#fff2e4', levels: ['#4a1a12', '#7f2e19', '#b6462a', '#d46a45', '#f0a184'], note: 'the house' },
  { id: 'ash', name: 'Ash & bone', bit: 2, tex: 'halftone', bed: '#0e0d0c', on: '#efe7db', accent: '#cfc5b0', hi: '#f4efe2', levels: ['#6b6459', '#8c8477', '#b0a693', '#cfc5b0', '#d9512f'], note: 'four colours' },
  { id: 'oxide', name: 'Oxide', bit: 4, tex: 'speckle', bed: '#120b09', on: '#efe7db', accent: '#b85a2e', hi: '#ffe8cf', levels: ['#59271a', '#8a3f24', '#b85a2e', '#d1814b', '#e9b184'], note: 'copper' },
  { id: 'paper', name: 'Paper', bit: 2, tex: 'grid', bed: '#d9d2c0', on: '#12100e', accent: '#b6462a', hi: '#14161a', levels: ['#9c907c', '#8a7f6b', '#b6462a', '#b6462a', '#b6462a'], note: 'the inversion' },
  { id: 'cathode', name: 'Cathode', bit: 2, tex: 'scan', bed: '#050a07', on: '#efe7db', accent: '#2f7f5b', hi: '#b9ffd4', levels: ['#1f5f3a', '#2f7f5b', '#2f7f5b', '#49a878', '#49a878'], note: 'phosphor' },
  { id: 'amber', name: 'Amber', bit: 4, tex: 'scan', bed: '#0b0803', on: '#efe7db', accent: '#c2730f', hi: '#fff3d0', levels: ['#5a2f06', '#8f4e0a', '#c2730f', '#e0a02c', '#ffd479'], note: 'terminal' },
  { id: 'smalti', name: 'Smalti', bit: 16, tex: 'speckle', bed: '#0d0b10', on: '#efe7db', accent: '#b6462a', hi: '#ffe6cf', levels: ['#6d4a12', '#8c5a1c', '#b6462a', '#d1703f', '#efa77e'], note: 'glass' },
  { id: 'thermal', name: 'Thermal', bit: 16, tex: 'scan', bed: '#07101c', on: '#efe7db', accent: '#8a5a4a', hi: '#fff0d8', levels: ['#1f3a63', '#2b5f7a', '#8a5a4a', '#c25a34', '#f5a35e'], note: 'heat scale' },
  { id: 'blueprint', name: 'Blueprint', bit: 4, tex: 'grid', bed: '#04121c', on: '#efe7db', accent: '#1f86a8', hi: '#eafcff', levels: ['#0f3b52', '#15607f', '#1f86a8', '#54b6cf', '#a8e6f2'], note: 'drawing' },
  { id: 'noir', name: 'Noir', bit: 2, tex: 'halftone', bed: '#0a0a0a', on: '#efe7db', accent: '#b8b8b8', hi: '#f5f2ea', levels: ['#3a3a3a', '#5a5a5a', '#8a8a8a', '#b8b8b8', '#f5f2ea'], note: 'printed' },
  { id: 'lamplit', name: 'Lamplit', bit: 8, tex: 'none', bed: '#0e1117', on: '#dfe3ea', accent: '#e29a4e', hi: '#ffd9a4', levels: ['#3a2a20', '#6b4526', '#ab6a2c', '#e29a4e', '#ffb066'], note: 'night street' },
  { id: 'sundown', name: 'Sundown', bit: 16, tex: 'scan', bed: '#1a1136', on: '#f4e9f6', accent: '#c2457c', hi: '#f6d9a0', levels: ['#3a2160', '#5a2a6b', '#8a3a7c', '#c2457c', '#f6d9a0'], note: 'pixel dusk' },
];

export const BITS: Bit[] = [2, 4, 8, 16];

const KEY_MATERIAL = 'tessera.material';
const KEY_BIT = 'tessera.bit';
const KEY_TEXT = 'tessera.text';

export const DEFAULT_MATERIAL = 'ember';

export function materialById(id: string | null | undefined): Material {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export type Choice = { id: string; bit: Bit; text: TextMode };

export function readChoice(): Choice {
  if (typeof document === 'undefined') return { id: DEFAULT_MATERIAL, bit: 8, text: 'pixel' };
  const root = document.documentElement;
  const id = root.dataset.material ?? DEFAULT_MATERIAL;
  const bit = Number(root.dataset.bit ?? materialById(id).bit) as Bit;
  const text = (root.dataset.text as TextMode) ?? 'pixel';
  return { id, bit: BITS.includes(bit) ? bit : 8, text };
}

/** write the choice onto <html>; theme.css turns it into tokens */
export function applyChoice(choice: Choice) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.material = choice.id;
  root.dataset.bit = String(choice.bit);
  root.dataset.text = choice.text;
  const m = materialById(choice.id);
  try {
    localStorage.setItem(KEY_MATERIAL, choice.id);
    localStorage.setItem(KEY_BIT, String(choice.bit));
    localStorage.setItem(KEY_TEXT, choice.text);
  } catch {
    /* private mode: the choice simply does not persist */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', m.bed);
  window.dispatchEvent(new CustomEvent<Choice>('tessera:material', { detail: choice }));
}

/** the material the app is wearing, as a value components can re-render on */
const subscribe = (fn: () => void) => {
  window.addEventListener('tessera:material', fn);
  return () => window.removeEventListener('tessera:material', fn);
};
const snapshot = () => {
  if (typeof document === 'undefined') return '{"id":"ember","bit":8,"text":"pixel"}';
  const root = document.documentElement;
  return `${root.dataset.material ?? 'ember'}|${root.dataset.bit ?? '8'}|${root.dataset.text ?? 'pixel'}`;
};

export function useMaterialChoice(): Choice {
  const raw = useSyncExternalStore(subscribe, snapshot, () => 'ember|8|pixel');
  const [id, bit, text] = raw.split('|');
  return { id, bit: Number(bit) as Bit, text: text as TextMode };
}

/** the boot script and the drawer agree on one key, one shape */
export const MATERIAL_KEYS = { material: KEY_MATERIAL, bit: KEY_BIT, text: KEY_TEXT };

/* ── the stone, so the button can show the material it is offering ────────── */

const toRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a: number[]) =>
  '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};

const QUANT: Record<Bit, number[]> = {
  2: [0, 0, 4, 4, 4],
  4: [0, 1, 3, 4, 4],
  8: [0, 1, 2, 3, 4],
  16: [0, 1, 2, 3, 4],
};
const STEPS: Record<Bit, number> = { 2: 2, 4: 3, 8: 5, 16: 5 };

const cache = new Map<string, string>();

/** a 16×16 cut stone at the material's budget — the one image in the switcher */
export function stone(m: Material, bit: Bit, level: number, frame = 0, variant = 0): string {
  const key = `${m.id}${bit}${level}${frame}${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const body = m.levels[QUANT[bit][level - 1]];
  const tones = STEPS[bit];
  const rim = mix(body, '#0a0607', bit >= 8 ? 0.8 : 0.92);
  const lit = tones >= 3 ? mix(body, m.hi, bit >= 16 ? 0.46 : bit >= 8 ? 0.32 : 0.2) : body;
  const shade = tones >= 4 ? mix(body, '#0a0607', 0.34) : body;
  const r = [3, 4, 5, 6, 7][level - 1] ?? 5;
  const skew = (variant % 3) - 1;
  const filled = new Set<string>();

  for (let y = 8 - r; y <= 8 + r - 1; y += 1) {
    const dy = Math.abs(y - 7.5);
    const half = Math.max(0, Math.round((r - dy) * 0.92));
    const cx = 8 + Math.round(skew * (dy / r));
    for (let x = cx - half; x <= cx + half; x += 1) if (x >= 0 && x < 16) filled.add(`${x},${y}`);
  }

  const cells = new Map<string, string>();
  for (const k of filled) {
    const [x, y] = k.split(',').map(Number);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !filled.has(`${x + dx},${y + dy}`));
    if (edge) cells.set(k, rim);
    else if (tones < 3) cells.set(k, body);
    else cells.set(k, x + y < 16 ? lit : x + y > 16 ? shade : body);
  }
  if (bit === 16) {
    const gx = 8 - r + 2 + skew;
    const gy = 8 - r + 2;
    if (filled.has(`${gx},${gy}`)) cells.set(`${gx},${gy}`, m.hi);
  }
  if (frame === 1 && level >= 4) {
    const sx = 8 + skew;
    if (filled.has(`${sx},${8 - r}`)) cells.set(`${sx},${8 - r}`, m.hi);
  }

  const rects = [...cells]
    .map(([k, c]) => {
      const [x, y] = k.split(',');
      return `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    })
    .join('');
  const uri =
    'data:image/svg+xml,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>`);
  cache.set(key, uri);
  return uri;
}
