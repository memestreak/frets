import type { Metadata } from 'next';
import { ChordsPageClient } from '@/features/chords/ChordsLoaders';

export const metadata: Metadata = { title: 'Chords · Frets' };

export default function ChordsPage() {
  return <ChordsPageClient />;
}
