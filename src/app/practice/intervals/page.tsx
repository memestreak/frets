import type { Metadata } from 'next';
import { IntervalTrainerClient } from '@/features/practice/TrainerLoaders';

export const metadata: Metadata = { title: 'Interval trainer · Frets' };

export default function IntervalsPage() {
  return <IntervalTrainerClient />;
}
