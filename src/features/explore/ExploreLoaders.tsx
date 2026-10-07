'use client';

import dynamic from 'next/dynamic';

/*
 * The Scale lab reads its saved settings from localStorage while
 * initialising state, so it renders on the client only (no hydration
 * mismatch).
 */
const Loading = () => <div className="min-h-[720px]" aria-busy="true" />;

export const ScaleLabClient = dynamic(
  () => import('./scales/ScaleLab'),
  { ssr: false, loading: Loading },
);

/** The circle of fifths reads its view from the URL's query string. */
export const CircleOfFifthsClient = dynamic(
  () => import('./circle/CircleOfFifths'),
  { ssr: false, loading: Loading },
);
