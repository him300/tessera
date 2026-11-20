'use client';

/**
 * The record, from this browser's side.
 *
 * Nothing secret lives here. The key is typed once into `/api/unlock`, which sets an
 * HttpOnly cookie the page cannot read; from then on every request carries it and the
 * server decides. A missing store, a locked record and an offline tab all read
 * differently, so every call resolves rather than throws.
 */

import type { Entry, Tag } from './model';

const DEVICE = 'tessera.device.v1';

export type StoreStatus = 'unknown' | 'local' | 'locked' | 'open' | 'offline';

/** What the key that opened this browser is allowed to do. */
export type Role = 'full' | 'view';

export type PullResult =
  | { status: 'open'; role: Role; entries: Entry[]; tags: Tag[]; total: number }
  | { status: 'locked' | 'local' | 'offline'; error: string };

export type PushResult =
  | { status: 'open'; stored: number; tagged: number; removed: number }
  | { status: 'locked' | 'local' | 'offline'; error: string };

/** An opaque id for this browser, so a row can be traced to the device that typed it. */
export function deviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const found = localStorage.getItem(DEVICE);
    if (found) return found;
    const made = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE, made);
    return made;
  } catch {
    return '';
  }
}

function head(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const device = deviceId();
  if (device) h['x-tessera-device'] = device;
  return h;
}

function classify(status: number): 'locked' | 'local' | 'offline' {
  if (status === 401) return 'locked';
  if (status === 501) return 'local';
  return 'offline';
}

export async function pull(): Promise<PullResult> {
  try {
    const response = await fetch('/api/entries', { headers: head(), cache: 'no-store' });
    const body = (await response.json().catch(() => ({}))) as {
      configured?: boolean;
      locked?: boolean;
      role?: Role;
      entries?: Entry[];
      tags?: Tag[];
      total?: number;
      error?: string;
    };
    if (body.configured === false) return { status: 'local', error: body.error ?? 'No server record on this build.' };
    if (body.locked === true) return { status: 'locked', error: body.error ?? 'That key does not open this record.' };
    if (!response.ok) {
      return { status: classify(response.status), error: body.error ?? `The record answered ${response.status}.` };
    }
    return {
      status: 'open',
      role: body.role === 'view' ? 'view' : 'full',
      entries: Array.isArray(body.entries) ? body.entries : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      total: Number(body.total ?? 0),
    };
  } catch {
    return { status: 'offline', error: 'The record could not be reached. This browser still holds its rows.' };
  }
}

export async function push(payload: {
  entries?: Entry[];
  tags?: Tag[];
  removed?: { rowKey: string; kind: string }[];
}): Promise<PushResult> {
  try {
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: head(),
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      configured?: boolean;
      locked?: boolean;
      stored?: number;
      tagged?: number;
      removed?: number;
      error?: string;
    };
    if (body.configured === false) return { status: 'local', error: body.error ?? 'No server record on this build.' };
    if (body.locked === true) return { status: 'locked', error: body.error ?? 'That key does not open this record.' };
    if (!response.ok) {
      return {
        status: response.status === 403 ? 'locked' : classify(response.status),
        error: body.error ?? `The record answered ${response.status}.`,
      };
    }
    return {
      status: 'open',
      stored: Number(body.stored ?? 0),
      tagged: Number(body.tagged ?? 0),
      removed: Number(body.removed ?? 0),
    };
  } catch {
    return { status: 'offline', error: 'The record could not be reached. Those rows are still in this browser.' };
  }
}

/** Present the key. On success the server sets the cookie and the record is read. */
export async function unlock(key: string): Promise<PullResult> {
  try {
    const response = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      configured?: boolean;
      unlocked?: boolean;
      role?: Role;
      error?: string;
    };
    if (body.configured === false) return { status: 'local', error: body.error ?? 'This build has no server store.' };
    if (!response.ok) {
      return {
        status: response.status === 401 ? 'locked' : 'offline',
        error: body.error ?? 'That key does not open this record.',
      };
    }
    const record = await pull();
    // The unlock response is authoritative about the level: the cookie it just set
    // cannot be read by the page, so this is the only place the browser learns it.
    return record.status === 'open' ? { ...record, role: body.role === 'view' ? 'view' : 'full' } : record;
  } catch {
    return { status: 'offline', error: 'The gate could not be reached. Try again when you are online.' };
  }
}

/** Drop the cookie on this browser. The record is untouched. */
export async function lock(): Promise<void> {
  try {
    await fetch('/api/unlock', { method: 'DELETE' });
  } catch {
    /* already offline: the cookie expires on its own */
  }
}
