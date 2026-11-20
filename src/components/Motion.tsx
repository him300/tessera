'use client';

import { Engine } from '@/engine/next';
import { setupMotion } from '@/motion/setup';
import { useEffect } from 'react';
import { store } from '@/lib/store';

export function Motion() {
  // Read this browser's record once, then keep the promise the phone kept at 00:05.
  useEffect(() => {
    store.hydrate();
    const s = store.getState();
    if (s.settings.autoTopUp) store.topUp({ quiet: true });
    // Then ask the durable record where it stands: open, locked, local only, offline.
    void store.connect();
  }, []);

  return <Engine setup={setupMotion} />;
}
