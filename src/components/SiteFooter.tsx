import Link from 'next/link';
import { site } from '@/data/site';

export function SiteFooter() {
  return (
    <footer className="os-foot os-wrap">
      <span>
        {site.name} · a record kept by hand · {new Date().getFullYear()}
      </span>
      <span className="os-row" style={{ gap: '1.2rem' }}>
        <Link href="/sources">Sources</Link>
        <Link href="/shape">Shape</Link>
        <Link href="/ledger">Ledger</Link>
      </span>
    </footer>
  );
}
