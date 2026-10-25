'use client';

import dynamic from 'next/dynamic';

/* The clip is read from storage and the link's hash, so the page renders on the client only. */
const Loading = () => <div className="min-h-[480px]" aria-busy="true" />;

export const TabPageClient = dynamic(
  () => import('./TabPage'),
  { ssr: false, loading: Loading },
);
