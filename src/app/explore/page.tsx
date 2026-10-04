import type { Metadata } from 'next';
import { PageList } from '@/components/PageList';
import { EXPLORE } from '@/components/sections';

export const metadata: Metadata = { title: 'Explore · Frets' };

export default function ExplorePage() {
  return (
    <div className="grid gap-3">
      <header>
        <h1 className="m-0">{EXPLORE.label}</h1>
        <p className="mt-1 mb-0">{EXPLORE.summary}</p>
      </header>
      <PageList pages={EXPLORE.pages} heading="h2" />
    </div>
  );
}
