import type { Metadata } from 'next';
import { MetronomePageClient } from '@/features/metronome/MetronomeLoader';

export const metadata: Metadata = { title: 'Metronome · Frets' };

export default function MetronomePage() {
  return <MetronomePageClient />;
}
