import type { Metadata } from 'next';
import { PageList } from '@/components/PageList';
import { PRACTICE } from '@/components/sections';

export const metadata: Metadata = { title: 'Practice · Frets' };

export default function PracticePage() {
  return (
    <div className="grid gap-3">
      <header>
        <h1 className="m-0">{PRACTICE.label}</h1>
        <p className="mt-1 mb-0">{PRACTICE.summary}</p>
      </header>
      <PageList pages={PRACTICE.pages} heading="h2" />
    </div>
  );
}
