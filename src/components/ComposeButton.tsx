'use client';

import type { DimKey } from '@/lib/model';
import { openComposer } from './Composer';

export function ComposeButton({
  children,
  dim,
  ghost = false,
}: {
  children: React.ReactNode;
  dim?: DimKey;
  ghost?: boolean;
}) {
  return (
    <button className={ghost ? 'btn btn--ghost' : 'btn'} type="button" onClick={() => openComposer(dim)}>
      {children}
    </button>
  );
}
