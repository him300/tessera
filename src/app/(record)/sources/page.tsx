import type { Metadata } from 'next';
import { SourcesView } from '@/components/Sources';

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'The workbook, the audit, the nightly top-up and the rows this browser is holding. Nothing is repaired without you.',
  alternates: { canonical: '/sources' },
};

export default function SourcesPage() {
  return (
    <main className="os-screen">
      <div className="os-screen__head">
        <h1>Sources</h1>
        <span className="os-tag">screen 5 of 5 · where the rows come from</span>
      </div>
      <section className="os-win">
        <div className="os-win__bar">
          <span>Sources</span>
          <span>workbook · audit · this browser</span>
        </div>
        <div className="os-win__body">
          <SourcesView />
        </div>
      </section>
    </main>
  );
}
