import type { Metadata } from 'next';
import { ShapeView } from '@/components/Shape';

export const metadata: Metadata = {
  title: 'Shape',
  description:
    'The 4 dimensions on one axis: presence per dimension across the window you choose, the consistency of each, and one sentence that says what the pattern is.',
  alternates: { canonical: '/shape' },
};

export default function ShapePage() {
  return (
    <ShapeView />
  );
}
