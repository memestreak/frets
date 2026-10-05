import type { Metadata } from 'next';
import { ChordLibraryClient } from '@/features/chords/ChordsLoaders';

export const metadata: Metadata = { title: 'Chord library · Frets' };

export default function ChordLibraryPage() {
  return <ChordLibraryClient />;
}
