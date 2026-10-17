'use client';

import dynamic from 'next/dynamic';

/* The tuner reads the mic and the query string, so it renders on the client only. */
const Loading = () => <div className="min-h-[640px]" aria-busy="true" />;

export const TunerPageClient = dynamic(
  () => import('./TunerMocks'),
  { ssr: false, loading: Loading },
);
