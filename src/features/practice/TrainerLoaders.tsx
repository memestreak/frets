'use client';

import dynamic from 'next/dynamic';

/*
 * Trainers read localStorage and draw a random question while initialising
 * state, so they render on the client only (no hydration mismatch).
 */
const Loading = () => <div className="min-h-[480px]" aria-busy="true" />;

export const IntervalTrainerClient = dynamic(
  () => import('./intervals/IntervalTrainer'),
  { ssr: false, loading: Loading },
);

export const NoteTrainerClient = dynamic(
  () => import('./notes/NoteTrainer'),
  { ssr: false, loading: Loading },
);
