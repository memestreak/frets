'use client';

import dynamic from 'next/dynamic';

/* The Metronome reads its saved rhythm and plays Web Audio, so it renders on the client only. */
const Loading = () => <div className="min-h-[640px]" aria-busy="true" />;

export const MetronomePageClient = dynamic(
  () => import('./MetronomePage'),
  { ssr: false, loading: Loading },
);
