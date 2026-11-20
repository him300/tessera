import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  DimensionPlotWindow,
  PresenceWindow,
  DimensionRows,
  DimensionSheet,
  DimensionStats,
} from '@/components/blocks';
import { ComposeButton } from '@/components/ComposeButton';
import { DIMENSIONS, DIM_ORDER, type DimKey } from '@/lib/model';
import { hue } from '@/components/ui';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const dim = DIM_ORDER.includes(slug as DimKey) ? DIMENSIONS[slug as DimKey] : null;
  if (!dim) return {};
  return {
    title: `${dim.label}, one dimension of the record`,
    description: `${dim.label} rows from the Tessera workbook: this week, the streak, the river of recent weeks and the shape of the window you choose.`,
    alternates: { canonical: `/dimension/${dim.key}` },
  };
}

export default async function DimensionPage({ params }: Params) {
  const { slug } = await params;
  if (!DIM_ORDER.includes(slug as DimKey)) notFound();
  const dim = slug as DimKey;
  const def = DIMENSIONS[dim];

  return (
    <main className="os-screen">
      <div className="os-screen__head">
        <h1 style={{ color: hue(dim) }}>{def.label}</h1>
        <span className="os-tag">
          <Link href="/">← floor</Link> · {def.tab} · {def.columns.length} columns
        </span>
      </div>

      <div className="os-wins">
        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>Four facts</span>
            <span>read from the tab</span>
          </div>
          <div className="os-win__body">
            <DimensionStats dim={dim} />
          </div>
        </section>

        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>{dim === 'success' ? 'The river' : 'The plot'}</span>
            <span>{dim === 'learning' ? 'spines' : dim === 'mind' ? 'waveform' : dim === 'body' ? 'rungs' : 'width is minutes'}</span>
          </div>
          <div className="os-win__body">
            <DimensionPlotWindow dim={dim} />
          </div>
        </section>

        <PresenceWindow dim={dim} />

        <section className="os-win os-win--half">
          <div className="os-win__bar">
            <span>Sheet</span>
            <span>audit</span>
          </div>
          <div className="os-win__body">
            <DimensionSheet dim={dim} />
          </div>
        </section>

        <section className="os-win os-win--half">
          <div className="os-win__bar">
            <span>The last rows</span>
            <span>append only</span>
          </div>
          <div className="os-win__body">
            <DimensionRows dim={dim} count={10} />
            <div className="os-row" style={{ marginTop: '0.8rem' }}>
              <ComposeButton dim={dim} ghost>
                Add a {def.label.toLowerCase()} row
              </ComposeButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
