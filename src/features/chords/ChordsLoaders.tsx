'use client';

import dynamic from 'next/dynamic';

/*
 * The Chord library reads its chord from the URL's query string, which a
 * static page only has in the browser, so it renders on the client only.
 */
const Loading = () => <div className="min-h-[720px]" aria-busy="true" />;

export const ChordLibraryClient = dynamic(
  () => import('./library/ChordLibrary'),
  { ssr: false, loading: Loading },
);
