'use client';

/**
 * Sources: where the record comes from, what condition it is in, and the two
 * decisions that keep it honest (the nightly top-up, and the fact that nothing is
 * quietly repaired).
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useNow } from '@/lib/clock';
import { check, issueLabel } from '@/lib/health';
import { DIMENSIONS, DIM_ORDER } from '@/lib/model';
import { appendRows, readWorkbook, token, workbookIdFromUrl } from '@/lib/sheets';
import { store, useStore } from '@/lib/store';
import { dateOf, prettyDate } from '@/lib/times';
import { Bulb, Label, hueVars } from './ui';
import { WorkbookLinks } from './WorkbookLinks';

export function SourcesView() {
  const state = useStore();
  const today = useNow();
  const clientId = state.settings.clientId;
  const workbooks = state.settings.workbooks;
  const primary = workbooks[0] ?? '';

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const audit = useMemo(
    () => DIM_ORDER.map((dim) => check(dim, state.entries.filter((e) => e.dim === dim))),
    [state.entries],
  );
  const issues = audit.reduce((n, r) => n + r.issues.length, 0);
  const queued = state.unsynced.length;

  const connect = async () => {
    if (workbooks.length === 0) return;
    setBusy('read');
    setError(null);
    setNote(null);
    try {
      const t = await token(clientId);
      // Every workbook on the record is read; rows are merged by instant, so two
      // sheets that hold the same row cannot double it.
      const reads = await Promise.all(
        workbooks.map(async (link) => readWorkbook(workbookIdFromUrl(link), t)),
      );
      const entries = reads.flatMap((r) => r.entries);
      const missing = [...new Set(reads.flatMap((r) => r.missing))];
      store.replaceFromSheet(entries);
      const where =
        reads.length === 1
          ? `“${reads[0].title}”`
          : `${reads.length} workbooks`;
      setNote(
        `Read ${entries.length} rows from ${where}${missing.length ? `. No tab for ${missing.map((m) => DIMENSIONS[m].label).join(', ')}.` : '.'}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    setBusy('push');
    setError(null);
    setNote(null);
    try {
      const t = await token(clientId);
      const id = workbookIdFromUrl(primary);
      const pending = state.entries.filter((e) => state.unsynced.includes(e.rowKey));
      let written = 0;
      for (const dim of DIM_ORDER) {
        const rows = pending.filter((e) => e.dim === dim);
        if (rows.length === 0) continue;
        written += await appendRows(id, t, dim, rows);
        store.markSynced(rows.map((r) => r.rowKey));
      }
      setNote(
        `Appended ${written} row${written === 1 ? '' : 's'} to the primary workbook${workbooks.length > 1 ? ' (the first one)' : ''}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const exportFile = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tessera-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNote('Exported what this browser holds, seed excluded.');
  };

  const importFile = async (f: File) => {
    const text = await f.text();
    const out = store.importJSON(text);
    setNote(out.ok ? `Imported ${out.rows} rows.` : 'That file did not look like a Tessera export.');
  };

  return (
    <>
      <div className="panels" style={{ marginTop: 'calc(var(--u) * 2)' }}>
        {/* connection */}
        <section className="panel" aria-labelledby="conn-h">
          <div className="panel__body">
            <h2 id="conn-h">Workbook</h2>
            <p>
              The record is one spreadsheet — four data tabs plus two companion tabs — but it can be
              read across several. Paste a link and it steps out of the field as a ghost, waiting for
              the next. The first is the primary: new rows are appended there. Your own OAuth client
              id goes with them. Nothing is stored on a server, because there is no server.
            </p>
            <WorkbookLinks />
            <label className="field">
              <span>OAuth client id</span>
              <input
                className="input"
                value={clientId}
                placeholder="000000000000-abc.apps.googleusercontent.com"
                onChange={(e) => store.setSetting('clientId', e.target.value)}
                spellCheck={false}
              />
            </label>
            <p>
              Scope: <b>spreadsheets</b> only. No Drive, no mail, no files. The token is kept in memory
              and forgotten when this tab closes.
            </p>
          </div>
          <div className="panel__side">
            <button
              className="btn"
              type="button"
              onClick={connect}
              disabled={busy !== null || workbooks.length === 0}
            >
              {busy === 'read'
                ? 'Reading…'
                : workbooks.length > 1
                  ? 'Read the workbooks'
                  : 'Read the workbook'}
            </button>
            <p>
              {workbooks.length === 0
                ? 'No workbook set, the record runs from this browser.'
                : workbooks.length === 1
                  ? `Workbook set, ${state.entries.length} rows held here.`
                  : `${workbooks.length} workbooks, new rows go to the first. ${state.entries.length} rows held here.`}
            </p>
            {queued > 0 ? (
              <button className="btn btn--ghost" type="button" onClick={push} disabled={busy !== null}>
                {busy === 'push' ? 'Appending…' : `Append ${queued} held row${queued === 1 ? '' : 's'}`}
              </button>
            ) : null}
            {note ? <p className="queue">{note}</p> : null}
            {error ? (
              <p className="queue" style={{ color: 'var(--i-success)' }}>
                {error}
              </p>
            ) : null}
          </div>
        </section>

        {/* top-up */}
        <section className="panel" aria-labelledby="topup-h">
          <div className="panel__body">
            <h2 id="topup-h">Every day exists</h2>
            <p>
              A day with no row is a hole, and a hole is the one thing a ledger cannot have. The top-up
              lays one row at <b>00:00</b> on any day that has nothing in it, in the sheet’s own words:
              Time_Allocated “Nothing”, Exercise “None”, reps “NaN”, with the sub-goal that was in force
              at the time. It never touches a row that already exists.
            </p>
            <div style={{ display: 'grid', gap: '0.9em' }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={state.settings.autoTopUp}
                  onChange={(e) => store.setSetting('autoTopUp', e.target.checked)}
                />
                <span>
                  Fill missing days whenever the record opens
                  <small>On the phone this ran at 00:05. Here it runs on the first read of the day.</small>
                </span>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={state.settings.includeToday}
                  onChange={(e) => store.setSetting('includeToday', e.target.checked)}
                />
                <span>
                  Include today
                  <small>With it off, today stays open until you add an entry of your own.</small>
                </span>
              </label>
            </div>
            {state.topUp ? (
              <p className="queue">
                Last run: {state.topUp.count} rows, through {prettyDate(state.topUp.through)}. {daysText(state.topUp.ids)}
              </p>
            ) : (
              <p className="queue">No top-up has run in this browser yet.</p>
            )}
          </div>
          <div className="panel__side">
            <button className="btn" type="button" onClick={() => store.topUp()}>
              Top up now
            </button>
            {state.topUp ? (
              <button className="btn btn--ghost" type="button" onClick={() => store.withdrawTopUp()}>
                Withdraw those {state.topUp.ids.length} rows
              </button>
            ) : null}
            <p>
              {state.settings.includeToday ? 'Filling through today.' : 'Filling through yesterday.'} Only
              rows this browser still holds can be withdrawn; once appended, the sheet is the record.
            </p>
          </div>
        </section>
      </div>

      {/* health */}
      <div className="section__head" style={{ paddingTop: 'calc(var(--u) * 5)' }}>
        <h2 className="display" style={{ gridColumn: '1 / span 6', fontSize: 'var(--t-l)' }}>
          The audit
        </h2>
        <p>
          {issues === 0
            ? 'Four tabs, no issue found. Ordering, duplicates, missing days and impossible instants are all checked on every read.'
            : `${issues} things to review across four tabs. Nothing is repaired for you.`}
        </p>
      </div>

      <div className="lights">
        {audit.map((report) => (
          <div className="light" key={report.dim} style={hueVars(report.dim)}>
            <div className="light__row">
              <Bulb dim={report.dim} healthy={report.healthy} />
              <span className="light__name">{DIMENSIONS[report.dim].label}</span>
            </div>
            <span className="light__val">
              {report.rows} rows · {report.activeDays} active · {report.spanDays} in span
            </span>
            <span className="light__val">
              {report.firstDay ? `${prettyDate(report.firstDay)} → ${prettyDate(report.lastDay ?? report.firstDay)}` : 'no rows'}
            </span>
            {report.issues.length ? (
              <ul className="light__val" style={{ display: 'grid', gap: '0.25em' }}>
                {report.issues.slice(0, 3).map((issue, i) => (
                  <li key={i}>
                    {issueLabel(issue.kind)}: {issue.detail}
                  </li>
                ))}
                {report.issues.length > 3 ? <li>and {report.issues.length - 3} more</li> : null}
              </ul>
            ) : (
              <span className="light__val">no issues</span>
            )}
          </div>
        ))}
      </div>

      {/* this browser */}
      <div className="panels">
        <section className="panel" aria-labelledby="floor-h">
          <div className="panel__body">
            <h2 id="floor-h">The record on the server</h2>
            <p>
              Rows can live in one database now, so closing the tab, clearing storage or opening
              the site somewhere else no longer costs you an entry. One key opens it, entered once
              per browser.
            </p>
            <p>
              Every write goes to both places: this browser first, then the record. A row typed while
              the network is down stays here and is sent by itself when the record answers again.
            </p>
          </div>
          <div className="panel__side">
            {state.store === 'open' ? (
              <>
                <p className="queue">
                  <Label>Open</Label>
                  <br />
                  {state.storeTotal} rows on the server, {state.unsynced.length} waiting here.
                </p>
                <button className="btn btn--ghost" type="button" onClick={() => void store.sync()}>
                  Send what this browser holds
                </button>
                <Link className="btn btn--ghost" href="/unlock">
                  Seal this browser
                </Link>
              </>
            ) : (
              <>
                <p className="queue">
                  <Label>{storeWord(state.store)}</Label>
                  <br />
                  {state.storeNote ?? 'Enter the key once and this browser writes to the floor.'}
                </p>
                <Link className="btn" href="/unlock">
                  Lay the key
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="local-h">
          <div className="panel__body">
            <h2 id="local-h">This browser</h2>
            <p>
              {queued === 0
                ? 'Every row this browser appended has been written to the server or to a workbook, or there is nothing to write.'
                : `${queued} rows are held here and have not reached the server yet. They are not lost: the record on screen is the record they are in.`}
            </p>
            <p>
              Export takes the rows you added and the tags you set. The 724 seeded rows are not
              copied into the export, because the seed still holds them.
            </p>
          </div>
          <div className="panel__side">
            <button className="btn btn--ghost" type="button" onClick={exportFile}>
              Export this browser
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => file.current?.click()}>
              Import a record
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = '';
              }}
            />
            <button className="btn btn--ghost" type="button" onClick={() => store.reset()}>
              Drop everything local
            </button>
            <p className="queue">
              <Label>Workbook clock</Label>
              <br />
              Africa/Johannesburg, today is {prettyDate(today)}
            </p>
          </div>
        </section>

        <section className="panel" aria-labelledby="tags-h">
          <div className="panel__body">
            <h2 id="tags-h">Highlights</h2>
            <p>
              A tag is not a column in a data tab. It is a row in <b>tessera_tags</b>, keyed to the
              dimension, the instant and the row’s ordinal, so a re-sort cannot move it to another row.
            </p>
          </div>
          <div className="panel__side">
            <p className="queue">
              {state.tags.length} tag{state.tags.length === 1 ? '' : 's'} set in this browser
            </p>
            <a className="btn btn--ghost" href="/ledger">
              Open the ledger
            </a>
          </div>
        </section>
      </div>
    </>
  );
}

/** `10 Nov, 11 Nov and 3 more` for the last top-up. */
function daysText(ids: string[]): string {
  if (ids.length === 0) return '';
  const days = [...new Set(ids.map((id) => id.split('|')[1]?.slice(0, 10)).filter(Boolean) as string[])].sort();
  const head = days.slice(0, 3).map(prettyDate).join(', ');
  return days.length > 3 ? `${head} and ${days.length - 3} more.` : `${head}.`;
}

export const sourceDate = dateOf;

/** One word for where the durable record is, as far as this browser knows. */
function storeWord(status: ReturnType<typeof useStore>['store']): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'locked':
      return 'Locked';
    case 'local':
      return 'Local only';
    case 'offline':
      return 'Unreachable';
    default:
      return 'Checking';
  }
}
