import type { Metadata } from 'next';
import { TunerPageClient } from '@/features/tuner/TunerLoader';

export const metadata: Metadata = { title: 'Tuner · Frets' };

export default function TunerPage() {
  return <TunerPageClient />;
}
