import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Frame } from '@/components/Frame';
import { ThemeBackdrop } from '@/components/ThemeBackdrop';
import { Dock } from '@/components/Dock';
import { Motion } from '@/components/Motion';
import { site } from '@/data/site';
import './globals.css';
import './ui.css';
import './theme.css';
import './shell.css';

// Today is computed in the workbook's zone on every request, so the record is never
// a build-time snapshot of a day that has already ended.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name}: four dimensions, one record`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name}: four dimensions, one record`,
    description: site.description,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'A floor of day tiles, 4 dimensions.' }],
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: '/apple-icon.png' },
  other: { 'theme-color': '#E7E2D4' },
};

// Before first paint: motion flags, and the theme the reader chose last time (or the
// system's), so a dark page never flashes limestone first.
const flags = `document.documentElement.classList.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion');try{var r=document.documentElement;r.dataset.material=localStorage.getItem('tessera.material')||'ember';r.dataset.bit=localStorage.getItem('tessera.bit')||'8';r.dataset.text=localStorage.getItem('tessera.text')||'pixel';}catch(e){var q=document.documentElement;q.dataset.material='ember';q.dataset.bit='8';q.dataset.text='pixel'}`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: site.name,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any, in a browser',
  url: site.url,
  description: site.description,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'ZAR' },
  creator: { '@type': 'Person', name: 'Tessera' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: flags }} />
        <link rel="preload" href="/fonts/zodiak-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/supreme-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to the record
        </a>

        <div id="curtain" aria-hidden="true">
          <div className="curtain__panel" />
          <div className="curtain__tiles">
            {Array.from({ length: 72 }).map((_, i) => (
              <span className="tile-fill" key={i} />
            ))}
          </div>
        </div>

        <ThemeBackdrop />
        <Frame />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Dock />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        <Motion />
      </body>
    </html>
  );
}
