import type { Metadata } from 'next';
import { ScaleLabClient } from '@/features/explore/ExploreLoaders';

export const metadata: Metadata = { title: 'Scale lab · Frets' };

export default function ScalesPage() {
  return <ScaleLabClient />;
}
