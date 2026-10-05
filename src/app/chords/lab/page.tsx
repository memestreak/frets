import type { Metadata } from 'next';
import ChordLab from '@/features/chords/lab/ChordLab';

export const metadata: Metadata = { title: 'Chord lab · Frets' };

export default function ChordLabPage() {
  return <ChordLab />;
}
