import type { Metadata } from 'next';
import { Threshold } from '@/components/Threshold';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: 'Threshold',
  description:
    'One key, entered once in this browser. After that every row you type is written to the floor itself, not to the tab alone.',
  alternates: { canonical: '/unlock' },
  openGraph: {
    title: `Threshold · ${site.name}`,
    description: 'Lay the key and step onto the floor. The record is written to the server, not to the tab.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'A line of tiles laid as a threshold.' }],
  },
  // A key page has nothing to say to a search engine, and everything to say to you.
  robots: { index: false, follow: false },
};

export default function ThresholdPage() {
  return <Threshold />;
}
