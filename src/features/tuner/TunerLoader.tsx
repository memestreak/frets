'use client';

import dynamic from 'next/dynamic';

/* The tuner reads the mic and storage, so it renders on the client only. */
const Loading = () => <div className="min-h-[640px]" aria-busy="true" />;

export const TunerPageClient = dynamic(
  () => import('./TunerPage'),
  { ssr: false, loading: Loading },
);
