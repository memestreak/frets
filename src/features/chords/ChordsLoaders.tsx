'use client';

import dynamic from 'next/dynamic';

/*
 * The Chord library reads its saved chord from localStorage while
 * initialising state, so it renders on the client only (no hydration
 * mismatch).
 */
const Loading = () => <div className="min-h-[720px]" aria-busy="true" />;

export const ChordLibraryClient = dynamic(
  () => import('./library/ChordLibrary'),
  { ssr: false, loading: Loading },
);
