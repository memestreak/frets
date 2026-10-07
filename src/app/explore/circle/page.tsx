import type { Metadata } from 'next';
import { CircleOfFifthsClient } from '@/features/explore/ExploreLoaders';

export const metadata: Metadata = { title: 'Circle of fifths · Frets' };

export default function CirclePage() {
  return <CircleOfFifthsClient />;
}
