/**
 * The gate.
 *
 * Two keys can open the record, and they open it differently:
 *
 *   TESSERA_KEY       the record itself: read every page, append rows
 *   TESSERA_VIEW_KEY  a look inside: read every page, write nothing
 *
 * `/api/unlock` checks the presented key against both secrets and sets an HttpOnly
 * cookie whose value is an HMAC of a fixed message under whichever secret matched. The
 * cookie therefore carries its own level, and nothing else has to be stored: rotating a
 * secret ends exactly the sessions made with it.
 *
 * There is still no user table and no session store. A build with no database and no
 * secret has nothing to protect and no way to check a key, so the gate stays open and
 * the site runs local-only. That is deliberate.
 */

import { cookies } from 'next/headers';
import { serverEnv, type D1 } from './d1';

export const SESSION_COOKIE = 'tessera.session';

/** Changing this string invalidates every outstanding cookie. */
const MESSAGE = 'tessera-session-v1';

const encoder = new TextEncoder();

const hex = (bytes: Uint8Array): string => {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
};

/** Compare two same-length strings without exiting on the first difference. */
export const same = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export type Role = 'full' | 'view';

export type Gate = { db: D1; secret: string; viewSecret: string | null };

/** The record and its keys, or null when this build has neither. */
export async function gate(): Promise<Gate | null> {
  const env = await serverEnv();
  if (!env?.DB || !env.TESSERA_KEY) return null;
  return { db: env.DB, secret: env.TESSERA_KEY, viewSecret: env.TESSERA_VIEW_KEY ?? null };
}

/** The cookie value for a given secret. */
export async function sessionToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(MESSAGE));
  return hex(new Uint8Array(signature));
}

/**
 * Which key opened this request, if any. A build with no gate is always full: there is
 * nothing to protect, so nothing is withheld.
 */
export async function role(secret?: string, viewSecret?: string | null): Promise<Role | null> {
  let key = secret;
  let view = viewSecret;
  if (key === undefined) {
    const g = await gate();
    if (!g) return 'full';
    key = g.secret;
    view = g.viewSecret;
  }
  if (!key) return 'full';

  const jar = await cookies();
  const presented = jar.get(SESSION_COOKIE)?.value ?? '';
  if (!presented) return null;

  if (same(presented, await sessionToken(key))) return 'full';
  if (view && same(presented, await sessionToken(view))) return 'view';
  return null;
}

/** Is this request carrying a cookie that matches either key? */
export async function isUnlocked(): Promise<boolean> {
  return (await role()) !== null;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: true,
  maxAge: 60 * 60 * 24 * 30,
};
