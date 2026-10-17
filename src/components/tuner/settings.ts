'use client';

import { useState } from 'react';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { isRefSound, type RefSound } from './sounds';

/** How the tuner shows how far off: a needle on a dial, or a strobe. */
export type Meter = 'dial' | 'strobe';

export const METERS: readonly (readonly [Meter, string])[] = [
  ['dial', 'Dial'],
  ['strobe', 'Strobe'],
];

/** The tuner's choices, one set for the Tuner page and the Note trainer's tuner. */
export interface TunerSettings {
  meter: Meter;
  /** What the string buttons play. */
  sound: RefSound;
}

export const TUNER_STORAGE_KEY = 'frets.tuner.settings';

export const defaultTunerSettings = (): TunerSettings => ({ meter: 'dial', sound: 'acoustic' });

/** Saved settings, each field checked; defaults for anything missing or wrong. */
export function parseTunerSettings(raw: unknown): TunerSettings {
  const d = defaultTunerSettings();
  if (typeof raw !== 'object' || raw == null) return d;
  const r = raw as Record<string, unknown>;
  return {
    meter: METERS.some(([m]) => m === r.meter) ? (r.meter as Meter) : d.meter,
    sound: isRefSound(r.sound) ? r.sound : d.sound,
  };
}

/** The tuner's settings, read from storage once and saved on every change. */
export function useTunerSettings() {
  const [settings, setSettings] = useState(() => parseTunerSettings(loadJson(TUNER_STORAGE_KEY)));
  usePersist(TUNER_STORAGE_KEY, settings);
  const update = (patch: Partial<TunerSettings>) => setSettings(s => ({ ...s, ...patch }));
  return [settings, update] as const;
}
