/**
 * The door.
 *
 * Every page of the record lives under this layout, so every page is checked here, on
 * the server, before a single row is rendered. There is no client-side guard to
 * bypass: without a cookie that matches the current secret, the answer is a redirect
 * to `/unlock`, and the gate is also enforced again on `/api/entries`.
 *
 * `/unlock` sits outside this group on purpose, and so does the 404.
 */

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { isUnlocked } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function RecordLayout({ children }: { children: ReactNode }) {
  if (!(await isUnlocked())) redirect('/unlock');
  return <>{children}</>;
}
