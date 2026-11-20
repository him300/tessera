'use client';

/**
 * The machine: a title bar, five screen keys, the material and the clock.
 * Below, the dock holds the depth and the text resolution; the status strip is the
 * machine's own footer. Nothing here knows what a record is.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClock } from '@/lib/clock';
import { DIM_ORDER } from '@/lib/model';
import { store, useStore } from '@/lib/store';
import { Material } from './Material';
import { DimensionMenu } from './DimensionMenu';
import { openComposer, Composer } from './Composer';
import { hue } from './ui';

const NAV = [
  { href: '/', label: 'Floor' },
  { href: '/shape', label: 'Shape' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/sources', label: 'Sources' },
];

export function Frame() {
  const path = usePathname();
  const clock = useClock();
  const state = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const live = state.entries.some((e) => e.minutes != null && e.at.slice(0, 10) === today);

  return (
    <header className="os-bar">
      <Link className="os-mark" href="/" aria-label="Tessera, the record">
        {DIM_ORDER.map((dim) => (
          <i key={dim} aria-hidden="true" style={{ background: hue(dim) }} />
        ))}
        Tessera<b style={{ color: 'var(--faint)', fontWeight: 400 }}>/os</b>
      </Link>

      <nav className="os-nav" aria-label="Screens">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={path === item.href ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
        <DimensionMenu />
      </nav>

      <div className="os-dock">
        <span className="os-live" title={live ? 'a row was written today' : 'nothing written today yet'}>
          <i aria-hidden="true" data-lit={live ? 'true' : 'false'} />
          <span>live</span>
        </span>
        <span className="os-clock" aria-label={`Workbook time ${clock}, Africa Johannesburg`}>
          <b>{clock}</b>
        </span>
        <Material />
        <button className="os-key os-key--solid" type="button" onClick={() => openComposer()}>
          + Entry
        </button>
      </div>

      <Composer />
    </header>
  );
}
