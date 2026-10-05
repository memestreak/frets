import type { Metadata } from 'next';
import { PageList } from '@/components/PageList';
import { CHORDS } from '@/components/sections';

export const metadata: Metadata = { title: 'Chords · Frets' };

export default function ChordsPage() {
  return (
    <div className="grid gap-3">
      <header>
        <h1 className="m-0">{CHORDS.label}</h1>
        <p className="mt-1 mb-0">{CHORDS.summary}</p>
      </header>
      <PageList pages={CHORDS.pages} heading="h2" />
    </div>
  );
}
