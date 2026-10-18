import type { Metadata } from 'next';
import { TriadsClient } from '@/features/explore/ExploreLoaders';

export const metadata: Metadata = { title: 'Triads · Frets' };

export default function TriadsPage() {
  return <TriadsClient />;
}
