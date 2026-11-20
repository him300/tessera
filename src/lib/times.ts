/**
 * Wall-clock arithmetic, in one place.
 *
 * The workbook is a wall clock, not an instant in time: a cell holds a spreadsheet
 * serial (days since 1899-12-30, the fraction is the time of day) or a string. The
 * site must never silently reinterpret one, so every conversion here is pure
 * arithmetic on local calendar parts, with no zone applied to a stored value.
 */

export const ZONE = 'Africa/Johannesburg';

const EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** 'YYYY-MM-DDTHH:mm:ss' from calendar parts. */
export const stamp = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;

export const dateOf = (at: string) => at.slice(0, 10);
export const timeOf = (at: string) => at.slice(11, 19);

/** 'HH:mm', seconds only when they matter. */
export const clock = (at: string) => {
  const t = timeOf(at);
  return t.endsWith(':00') ? t.slice(0, 5) : t;
};

/** A spreadsheet serial to wall clock. Rounded to the second, so 08:28:59.9 is never 08:28:59. */
export function fromSerial(serial: number): string {
  const total = Math.round(serial * 86400);
  const days = Math.floor(total / 86400);
  const secs = ((total % 86400) + 86400) % 86400;
  const d = new Date(EPOCH_MS + days * DAY_MS);
  return stamp(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    Math.floor(secs / 3600),
    Math.floor((secs % 3600) / 60),
    secs % 60,
  );
}

/** Wall clock to a serial, for writing back to a sheet. */
export function toSerial(at: string): number {
  const [y, mo, d] = at.slice(0, 10).split('-').map(Number);
  const [h, mi, s] = at.slice(11, 19).split(':').map(Number);
  const days = Math.round((Date.UTC(y, mo - 1, d) - EPOCH_MS) / DAY_MS);
  return days + (h * 3600 + mi * 60 + s) / 86400;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const DMY = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Everything the four datasets have ever contained: a serial as text or number,
 * `2026-04-15`, `2026-04-15 19:41`, `2026-04-15 19:41:00`, and `01/05/2026`.
 * Returns null rather than guessing.
 */
export function parseAt(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 1 ? fromSerial(raw) : null;
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^(nothing|none|nan|n\/a|-)$/i.test(s)) return null;

  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 1) return fromSerial(Number(s));

  const iso = ISO.exec(s);
  if (iso) {
    const [, y, mo, d, h, mi, se] = iso;
    if (!valid(+y, +mo, +d)) return null;
    return stamp(+y, +mo, +d, +(h ?? 0), +(mi ?? 0), +(se ?? 0));
  }
  const dmy = DMY.exec(s);
  if (dmy) {
    const [, d, mo, y, h, mi, se] = dmy;
    if (!valid(+y, +mo, +d)) return null;
    return stamp(+y, +mo, +d, +(h ?? 0), +(mi ?? 0), +(se ?? 0));
  }
  return null;
}

function valid(y: number, mo: number, d: number) {
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Today in the workbook's zone. The device's own zone is never consulted. */
export function today(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

/** The clock in the workbook's zone, 'HH:mm'. */
export function clockNow(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export const addDays = (date: string, n: number): string => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string): number => {
  const ms = (s: string) => {
    const [y, mo, d] = s.split('-').map(Number);
    return Date.UTC(y, mo - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / DAY_MS);
};

/** Every date from a to b inclusive. */
export function datesBetween(a: string, b: string): string[] {
  const out: string[] = [];
  const n = daysBetween(a, b);
  for (let i = 0; i <= n; i++) out.push(addDays(a, i));
  return out;
}

export const weekday = (date: string): number => {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0 = Sunday
};

/** ISO week starts Monday. */
export const mondayOf = (date: string): string => {
  const w = (weekday(date) + 6) % 7;
  return addDays(date, -w);
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthName = (m: number) => MONTHS[m - 1];
export const monthShort = (m: number) => MONTHS_S[m - 1];
export const dayShort = (date: string) => DAYS_S[weekday(date)];

/** `09 Nov 2026` */
export function prettyDate(date: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  return `${pad(d)} ${monthShort(mo)} ${y}`;
}

/** `09 Nov`, for an axis that has no room for a year */
export function shortDate(date: string): string {
  const [, mo, d] = date.split('-').map(Number);
  return `${pad(d)} ${monthShort(mo)}`;
}

/** `Mon 09 Nov` */
export function prettyDayDate(date: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  return `${dayShort(date)} ${pad(d)} ${monthShort(mo)} ${y}`;
}

/** `19:41` today, `09 Nov` before today. */
export function ledgerStamp(at: string, now: string): string {
  const d = dateOf(at);
  return d === now ? clock(at) : `${pad(+d.slice(8, 10))} ${monthShort(+d.slice(5, 7))}`;
}

/** Minutes as the sheets write them: 75 → `1h 15mins`, 20 → `20mins`. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}mins`;
  if (h > 0) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${m}mins`;
}

/** Broken-down duration for display: 75 → { h: 1, m: 15 }. */
export const splitMinutes = (total: number) => ({ h: Math.floor(total / 60), m: total % 60 });
