import type { Metadata } from 'next';
import { LedgerView } from '@/components/Ledger';

export const metadata: Metadata = {
  title: 'Ledger',
  description:
    'Every row from the four tabs as a reading surface: instant, dimension, line and figure, with the four highlights a row can carry.',
  alternates: { canonical: '/ledger' },
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const clean = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;

  return (
    <main className="os-screen">
      <div className="os-screen__head">
        <h1>Ledger</h1>
        <span className="os-tag">screen 4 of 5 · every row, in order</span>
      </div>
      <section className="os-win">
        <div className="os-win__bar">
          <span>The ledger</span>
          <span>append only · nothing rewritten</span>
        </div>
        <div className="os-win__body">
          <LedgerView day={clean} />
        </div>
      </section>
    </main>
  );
}
