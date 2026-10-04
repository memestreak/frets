import type { Metadata } from 'next';
import { NoteTrainerClient } from '@/features/practice/TrainerLoaders';

export const metadata: Metadata = { title: 'Note trainer · Frets' };

export default function NotesPage() {
  return <NoteTrainerClient />;
}
