'use client';

/**
 * The workbook, read and appended from the browser.
 *
 * There is no backend and no server holding a token: the OAuth client you paste in
 * is your own, the scope is `spreadsheets` only, and the access token lives in
 * memory for about an hour. If nothing is configured, the record still works from
 * this browser alone.
 *
 * This is the one part of the site that needs your own credentials; it is documented
 * in SETUP.md and it fails with a sentence rather than a stack trace.
 */

import { DIMENSIONS, DIM_ORDER, type DimKey, type Entry } from './model';
import { entriesFromValues, rowOf } from './rows';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { message?: string }) => void;
          }) => { requestAccessToken: (o?: { prompt?: string }) => void };
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let cached: { token: string; until: number } | null = null;
let gis: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gis) return gis;
  gis = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google sign-in could not be loaded. Check the network and try again.'));
    document.head.appendChild(s);
  });
  return gis;
}

/** A token in memory, requested inside a click so the popup is allowed. */
export async function token(clientId: string): Promise<string> {
  if (!clientId.trim()) throw new Error('Add your OAuth client ID first.');
  if (cached && cached.until > Date.now() + 30_000) return cached.token;
  await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: SCOPE,
      prompt: '',
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error || 'No token returned.'));
        cached = { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.message || 'The consent window was closed.')),
    });
    client.requestAccessToken();
  });
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function get<T>(url: string, t: string): Promise<T> {
  const res = await fetch(url, { headers: auth(t) });
  const body = await res.text();
  if (!res.ok) throw new Error(friendly(res.status, body));
  return JSON.parse(body) as T;
}

function friendly(status: number, body: string): string {
  if (status === 401) return 'That token expired. Connect again.';
  if (status === 403) return 'This account cannot open that workbook. Share it with yourself and retry.';
  if (status === 404) return 'No workbook with that id. Check the id in the sheet url.';
  if (status === 429) return 'Google is rate limiting the reads. Wait a minute and retry.';
  return `${status}: ${body.slice(0, 160)}`;
}

export type WorkbookInfo = { title: string; tabs: string[] };

export async function workbookInfo(id: string, t: string): Promise<WorkbookInfo> {
  const j = await get<{
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  }>(`${API}/${encodeURIComponent(id)}?fields=properties.title,sheets.properties.title`, t);
  return {
    title: j.properties?.title ?? '(untitled)',
    tabs: (j.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean),
  };
}

/** Read all four tabs in one request per tab group. */
export async function readWorkbook(
  id: string,
  t: string,
): Promise<{ entries: Entry[]; missing: DimKey[]; title: string }> {
  const info = await workbookInfo(id, t);
  const wanted = DIM_ORDER.filter((d) => info.tabs.includes(DIMENSIONS[d].tab));
  const missing = DIM_ORDER.filter((d) => !info.tabs.includes(DIMENSIONS[d].tab));
  if (wanted.length === 0) {
    throw new Error(
      `No tab named ${DIM_ORDER.map((d) => DIMENSIONS[d].tab).join(', ')} in “${info.title}”.`,
    );
  }
  const ranges = wanted.map((d) => `${DIMENSIONS[d].tab}!A1:F4000`).map(encodeURIComponent);
  const j = await get<{ valueRanges?: { values?: unknown[][] }[] }>(
    `${API}/${encodeURIComponent(id)}/values:batchGet?ranges=${ranges.join('&ranges=')}&valueRenderOption=UNFORMATTED_VALUE`,
    t,
  );
  const entries: Entry[] = [];
  wanted.forEach((dim, i) => {
    const values = j.valueRanges?.[i]?.values ?? [];
    entries.push(...entriesFromValues(dim, values));
  });
  return { entries, missing, title: info.title };
}

/** Append rows to one tab. The only write the site performs. */
export async function appendRows(id: string, t: string, dim: DimKey, rows: Entry[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values = [...rows].sort((a, b) => (a.at < b.at ? -1 : 1)).map((e) => rowOf(dim, e));
  const res = await fetch(
    `${API}/${encodeURIComponent(id)}/values/${encodeURIComponent(DIMENSIONS[dim].tab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { ...auth(t), 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(friendly(res.status, body));
  const j = JSON.parse(body) as { updates?: { updatedRows?: number } };
  return j.updates?.updatedRows ?? rows.length;
}

export const isConfigured = (clientId: string, workbook: string) =>
  Boolean(clientId.trim() && workbook.trim());

export const workbookIdFromUrl = (input: string): string => {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
};
