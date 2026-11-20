'use client';

/**
 * The workbook field, plural.
 *
 * One spreadsheet is a string; several are a list, and a list needs a shape. So a
 * pasted link is not kept in the input — it leaves, fades up into a ghost line
 * above the field, and the input clears and waits for the next one. Enter commits
 * what you typed, paste commits immediately, Backspace on an empty field takes the
 * last one back.
 *
 * The first ghost is the primary: it is the sheet new rows are appended to. The
 * rest are read alongside it.
 */

import { useRef, useState, type CSSProperties } from 'react';
import { DIM_ORDER } from '@/lib/model';
import { workbookIdFromUrl } from '@/lib/sheets';
import { store, useStore } from '@/lib/store';
import { hueInk } from './ui';

/** A full sheet url is pasted; only the id is kept. */
const looksLikeId = (id: string) => /^[a-zA-Z0-9_-]{12,}$/.test(id);

/** Long ids are illegible and identical at a glance: keep both ends. */
const ghostLabel = (id: string) =>
  id.length > 26 ? `${id.slice(0, 11)}…${id.slice(-7)}` : id;

const SPLIT = /[\s,]+/;

export function WorkbookLinks() {
  const { settings } = useStore();
  const links = settings.workbooks;
  const [draft, setDraft] = useState('');
  const [bad, setBad] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  /** Paste, or type and press Enter: everything in the text becomes ghosts. */
  const commit = (text: string) => {
    const found = text
      .split(SPLIT)
      .map((part) => workbookIdFromUrl(part.trim()))
      .filter(Boolean);
    if (found.length === 0) return;

    const valid = found.filter(looksLikeId);
    const fresh = valid.filter(
      (id) => !store.getState().settings.workbooks.includes(id),
    );

    if (valid.length === 0) {
      setBad('That is not a sheet id. Paste the link and the id is taken from it.');
      return;
    }
    if (fresh.length === 0) {
      setBad('Already on the record.');
      return;
    }

    store.setSetting('workbooks', [...store.getState().settings.workbooks, ...fresh]);
    setDraft('');
    setBad(null);
  };

  const drop = (id: string) => {
    // Let the ghost fade before it stops existing.
    setLeaving(id);
    window.setTimeout(() => {
      const current = store.getState().settings.workbooks;
      store.setSetting('workbooks', current.filter((w) => w !== id));
      setLeaving((now) => (now === id ? null : now));
    }, 280);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === 'Backspace' && draft === '' && links.length > 0) {
      event.preventDefault();
      drop(links[links.length - 1]);
      return;
    }
    if (event.key === 'Escape' && draft !== '') {
      event.preventDefault();
      setDraft('');
      setBad(null);
    }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!text.trim()) return;
    event.preventDefault();
    commit(text);
  };

  return (
    <div className="wb">
      {links.length > 0 ? (
        <ul className="wb__ghosts">
          {links.map((id, i) => {
            const dim = DIM_ORDER[i % DIM_ORDER.length];
            return (
              <li
                key={id}
                className="wb__ghost"
                data-leaving={leaving === id ? 'true' : undefined}
                data-primary={i === 0 ? 'true' : undefined}
                style={{ '--hue': hueInk(dim) } as CSSProperties}
              >
                <span aria-hidden="true" className="wb__shard" />
                <span className="wb__id" title={id}>
                  {ghostLabel(id)}
                </span>
                {i === 0 ? <span className="wb__role">primary</span> : null}
                <button
                  type="button"
                  className="wb__drop"
                  onClick={() => drop(id)}
                  aria-label={`Remove ${ghostLabel(id)}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <label className="field">
        <span>{links.length === 0 ? 'Spreadsheet id or url' : 'Another spreadsheet'}</span>
        <input
          ref={input}
          className="input wb__entry"
          value={draft}
          placeholder={
            links.length === 0
              ? 'the sheet id, or the whole url'
              : 'paste the next one, or leave it be'
          }
          onChange={(event) => {
            setDraft(event.target.value);
            if (bad) setBad(null);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={bad ? 'wb-bad' : undefined}
        />
      </label>

      <p className="sr-only" role="status">
        {links.length === 0
          ? 'No spreadsheet on the record.'
          : `${links.length} spreadsheet${links.length === 1 ? '' : 's'} on the record. The first is the primary.`}
      </p>
      {bad ? (
        <p className="wb__bad" id="wb-bad">
          {bad}
        </p>
      ) : null}
    </div>
  );
}
