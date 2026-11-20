'use client';

/**
 * One button, one stored choice. The inline script in the layout has already set
 * `data-theme` before paint, so this only has to read it, flip it and stay in sync
 * with the other copy of itself (the header and the phone menu each have one).
 *
 * With no stored choice the page follows the system; choosing a theme makes the
 * choice explicit, and choosing the same theme as the system is still a choice.
 */

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'tessera.theme';

const current = (): Theme => {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark' || attr === 'light') return attr;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#131519' : '#E7E2D4');
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(current());
    const sync = () => setTheme(current());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      if (e.newValue === 'dark' || e.newValue === 'light') {
        apply(e.newValue);
        sync();
      }
    };
    window.addEventListener('tessera:theme', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('tessera:theme', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      apply(mq.matches ? 'dark' : 'light');
      setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);

  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
    setTheme(next);
    window.dispatchEvent(new Event('tessera:theme'));
  };

  return (
    <button
      className={`themebtn${className ? ' ' + className : ''}`}
      type="button"
      onClick={flip}
      aria-pressed={theme === 'dark'}
      aria-label="Dark theme"
      title={theme === 'dark' ? 'Use the light theme' : 'Use the dark theme'}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M13.2 9.9A5.6 5.6 0 0 1 6.1 2.8a5.6 5.6 0 1 0 7.1 7.1Z" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
