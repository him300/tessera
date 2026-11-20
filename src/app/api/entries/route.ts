/**
 * `/api/entries` — the record, read and appended over HTTP.
 *
 * Two ways in, both checked on the server: the opening cookie that `/api/unlock` set
 * (what the site uses), or `authorization: Bearer <key>` for curl and for a phone that
 * has no browser session. The key is a Worker secret; it is never in a response and
 * never in a log line.
 *
 * A build with no database binding answers `configured: false` and the site keeps
 * working from the browser alone, exactly as it did before. That is deliberate:
 * `next start` on a laptop should not need Cloudflare to run.
 */

import { countRecord, keyOpens, readRecord, writeRecord, type D1, type WriteIn } from '@/lib/d1';
import { gate, role as sessionRole, type Role } from '@/lib/session';

export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store', 'content-type': 'application/json' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

/**
 * A build with no database binding still answers, so the browser never sees a failed
 * request on a page that is working exactly as intended.
 */
const NO_STORE = () =>
  json({ configured: false, error: 'This build has no server store, so the record stays in this browser.' });

/** The key from a header, never from a query string, which would be logged. */
function bearer(request: Request): string {
  const raw = request.headers.get('authorization') ?? request.headers.get('x-tessera-key') ?? '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

async function open(
  request: Request,
): Promise<{ db: D1 | null; role: Role | null; denied: Response | null }> {
  const g = await gate();
  if (!g) return { db: null, role: null, denied: NO_STORE() };

  // The cookie is the normal way in: HttpOnly, unreadable from the page, checked here.
  // Its level is carried by which secret signed it, so a view cookie cannot be edited
  // into a full one.
  const cookieRole = await sessionRole(g.secret, g.viewSecret);
  if (cookieRole) return { db: g.db, role: cookieRole, denied: null };

  const given = bearer(request);
  // No credential at all is not a failed request: the answer is "this record is locked",
  // and a browser that has never been unlocked should not see a red line in its console.
  if (!given) {
    return { db: null, role: null, denied: json({ configured: true, locked: true, error: 'A key is needed.' }) };
  }
  if (await keyOpens(given, g.secret)) return { db: g.db, role: 'full', denied: null };
  if (g.viewSecret && (await keyOpens(given, g.viewSecret))) {
    return { db: g.db, role: 'view', denied: null };
  }
  return { db: null, role: null, denied: json({ configured: true, error: 'That key does not open this record.' }, 401) };
}

export async function GET(request: Request) {
  const { db, role, denied } = await open(request);
  if (denied) return denied;
  if (!db) return NO_STORE();

  try {
    const record = await readRecord(db);
    const total = await countRecord(db);
    return json({ configured: true, ...record, total, role });
  } catch (error) {
    return json({ configured: true, error: `The record could not be read: ${(error as Error).message}` }, 500);
  }
}

export async function POST(request: Request) {
  const { db, role, denied } = await open(request);
  if (denied) return denied;
  if (!db) return NO_STORE();

  // A look inside never becomes a write, whatever the request body says.
  if (role !== 'full') {
    return json({ configured: true, readonly: true, error: 'That key can read the record but not write to it.' }, 403);
  }

  let body: WriteIn;
  try {
    body = (await request.json()) as WriteIn;
  } catch {
    return json({ configured: true, error: 'That request was not JSON.' }, 400);
  }

  const entries = Array.isArray(body.entries) ? body.entries : [];
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const removed = Array.isArray(body.removed) ? body.removed : [];
  if (entries.length + tags.length + removed.length > 400) {
    return json({ configured: true, error: 'Send at most 400 rows in one request.' }, 413);
  }

  try {
    const written = await writeRecord(db, {
      entries,
      tags,
      removed,
      device: request.headers.get('x-tessera-device') ?? undefined,
    });
    return json({ configured: true, ...written });
  } catch (error) {
    return json({ configured: true, error: `The record could not be written: ${(error as Error).message}` }, 500);
  }
}
