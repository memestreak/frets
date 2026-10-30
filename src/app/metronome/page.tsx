import type { Metadata } from 'next';
import MetronomeMocks from '@/features/metronome/mocks/MetronomeMocks';

export const metadata: Metadata = { title: 'Metronome · Frets' };

export default function MetronomePage() {
  return <MetronomeMocks />;
}
