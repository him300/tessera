/**
 * `/api/unlock` — present a key, and receive the cookie that opens the record.
 *
 * Two keys are accepted. `TESSERA_KEY` opens the record for reading and writing;
 * `TESSERA_VIEW_KEY` opens the same pages and refuses every write. The key itself is
 * never stored: the cookie is an HMAC of a fixed message under whichever secret
 * matched, so it cannot be turned back into the key and it dies with that secret.
 * `DELETE` clears it.
 */

import { NextResponse } from 'next/server';
import { keyOpens } from '@/lib/d1';
import { COOKIE_OPTIONS, SESSION_COOKIE, gate, sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'no-store' };

export async function POST(request: Request) {
  const g = await gate();
  if (!g) {
    return NextResponse.json(
      { configured: false, error: 'This build has no server store, so there is nothing to unlock.' },
      { status: 200, headers: noStore },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { key?: string };
  const key = String(body.key ?? '').trim();
  if (!key) {
    return NextResponse.json({ configured: true, error: 'A key is needed.' }, { status: 400, headers: noStore });
  }

  // The full key first: a record you own should never be mistaken for a look inside.
  const full = await keyOpens(key, g.secret);
  const view = full || !g.viewSecret ? false : await keyOpens(key, g.viewSecret);

  if (!full && !view) {
    return NextResponse.json(
      { configured: true, error: 'That key does not open this record.' },
      { status: 401, headers: noStore },
    );
  }

  const response = NextResponse.json(
    { configured: true, unlocked: true, role: full ? 'full' : 'view' },
    { headers: noStore },
  );
  response.cookies.set({
    ...COOKIE_OPTIONS,
    name: SESSION_COOKIE,
    value: await sessionToken(full ? g.secret : g.viewSecret!),
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ unlocked: false }, { headers: noStore });
  response.cookies.set({ ...COOKIE_OPTIONS, name: SESSION_COOKIE, value: '', maxAge: 0 });
  return response;
}
