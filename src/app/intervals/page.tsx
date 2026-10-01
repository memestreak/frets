import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { IntervalTrainerClient } from '@/components/TrainerLoaders';

export const metadata: Metadata = { title: 'Interval trainer · Frets' };

export default function IntervalsPage() {
  return (
    <AppShell active="intervals">
      <IntervalTrainerClient />
    </AppShell>
  );
}
