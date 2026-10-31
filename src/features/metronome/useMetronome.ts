'use client';

/**
 * The Metronome page's metronome: the core (`useMetronomeCore.ts`), plus what only the page does.
 * It loads and saves the rhythm and the volume, and Space starts and stops it.
 */
import { useEffect, useMemo } from 'react';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { usePersist } from '@/hooks/usePersist';
import { loadJson, saveJson } from '@/lib/storage';
import { PLAYBACK_KEY, RHYTHM_KEY, parsePlayback, parseRhythm } from './storage';
import { useMetronomeCore } from './useMetronomeCore';

export function useMetronome() {
  const m = useMetronomeCore(() => ({
    rhythm: parseRhythm(loadJson(RHYTHM_KEY)),
    volume: parsePlayback(loadJson(PLAYBACK_KEY)).volume,
  }));
  const { rhythm, volume, toggle } = m;

  useEffect(() => {
    saveJson(RHYTHM_KEY, rhythm);
  }, [rhythm]);
  usePersist(PLAYBACK_KEY, useMemo(() => ({ volume }), [volume]));
  useSpaceKey(toggle);

  return m;
}
