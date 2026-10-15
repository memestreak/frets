'use client';

import dynamic from 'next/dynamic';

/*
 * The Chords page reads its chord and shape from the URL's query string,
 * which a static page only has in the browser, so it renders on the client
 * only.
 */
const Loading = () => <div className="min-h-[720px]" aria-busy="true" />;

export const ChordsPageClient = dynamic(
  () => import('./ChordsPage'),
  { ssr: false, loading: Loading },
);
