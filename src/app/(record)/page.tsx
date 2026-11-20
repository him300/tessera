import Link from 'next/link';
import { COPY } from '@/data/site';
import { Floor, FloorLegend } from '@/components/Floor';
import { ComposeButton } from '@/components/ComposeButton';
import { Courses, LatestRows, RecordFacts, Lights } from '@/components/blocks';

export default function Home() {
  return (
    <main className="os-screen">
      <div className="os-screen__head">
        <h1>Floor</h1>
        <span className="os-tag">screen 1 of 5 · 4 dimensions · append only</span>
      </div>

      <div className="os-wins">
        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>The floor</span>
            <span>one tile a day · four shards</span>
          </div>
          <div className="os-win__body">
            <Floor />
            <FloorLegend />
          </div>
        </section>

        <section className="os-win os-win--half">
          <div className="os-win__bar">
            <span>Record</span>
            <span>chosen window</span>
          </div>
          <div className="os-win__body">
            <RecordFacts />
          </div>
        </section>

        <section className="os-win os-win--half">
          <div className="os-win__bar">
            <span>Lights</span>
            <span>consistency · chosen window</span>
          </div>
          <div className="os-win__body">
            <Lights compact />
          </div>
        </section>

        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>{COPY.courses.head}</span>
            <span>minutes · days · as chosen</span>
          </div>
          <div className="os-win__body">
            <Courses />
          </div>
        </section>

        <section className="os-win os-win--wide">
          <div className="os-win__bar">
            <span>{COPY.entry.head}</span>
            <span>last six</span>
          </div>
          <div className="os-win__body">
            <LatestRows count={6} />
            <div className="os-row" style={{ marginTop: '0.8rem' }}>
              <ComposeButton>Add an entry</ComposeButton>
              <Link className="os-key" href="/ledger">
                Read the ledger
              </Link>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
