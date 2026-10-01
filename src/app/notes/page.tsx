import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { NoteTrainerClient } from '@/components/TrainerLoaders';

export const metadata: Metadata = { title: 'Note trainer · Frets' };

export default function NotesPage() {
  return (
    <AppShell active="notes">
      <NoteTrainerClient />
    </AppShell>
  );
}
