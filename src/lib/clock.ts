'use client';

import { useEffect, useState } from 'react';
import { clockNow, today } from './times';

/**
 * Today in the workbook's zone, kept fresh. The date is computed once on render so
 * the server and the client agree, then a timer crosses midnight for us.
 */
export function useNow(): string {
  const [now, setNow] = useState(() => today());
  useEffect(() => {
    const id = window.setInterval(() => setNow(today()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** The wall clock in the workbook's zone, 'HH:mm'. */
export function useClock(): string {
  const [at, setAt] = useState(() => clockNow());
  useEffect(() => {
    const id = window.setInterval(() => setAt(clockNow()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return at;
}
