'use client';

/**
 * MOCK ONLY (?mock=alphatab): alphaTex drawn by alphaTab, for comparing
 * with Frets' own drawing. alphaTab loads only when this is shown.
 */
import { useEffect, useRef, useState } from 'react';

/** A Fretwood token's value, for alphaTab, which needs real colours. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Bumps when the theme changes, so the drawing picks up the new colours. */
function useThemeKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const bump = () => setKey(k => k + 1);
    const observer = new MutationObserver(bump);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', bump);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', bump);
    };
  }, []);
  return key;
}

export default function AlphaTabClip({ tex }: { tex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useThemeKey();

  useEffect(() => {
    let cancelled = false;
    let api: { destroy(): void } | null = null;
    void import('@coderline/alphatab').then(at => {
      const el = ref.current;
      if (cancelled || !el) return;
      el.replaceChildren();
      const ink = token('--ink');
      const muted = token('--ink-muted');
      const settings = new at.Settings();
      settings.fillFromJson({
        core: { useWorkers: false, fontDirectory: '/alphatab/font/', enableLazyLoading: false },
        display: {
          staveProfile: 'Tab',
          scale: 1.2,
          resources: {
            mainGlyphColor: ink, secondaryGlyphColor: muted, scoreInfoColor: ink,
            staffLineColor: ink, barSeparatorColor: ink, barNumberColor: muted,
          },
        },
        player: { playerMode: 'Disabled' },
      });
      settings.notation.rhythmMode = at.TabRhythmMode.ShowWithBars;
      for (const element of [at.NotationElement.EffectDynamics, at.NotationElement.ScoreTitle, at.NotationElement.TrackNames, at.NotationElement.EffectTempo, at.NotationElement.GuitarTuning]) {
        settings.notation.elements.set(element, false);
      }
      const instance = new at.AlphaTabApi(el, settings);
      instance.error.on(e => setError(String((e as Error).message ?? e)));
      instance.tex(tex);
      api = instance;
    });
    return () => {
      cancelled = true;
      api?.destroy();
    };
  }, [tex, theme]);

  return (
    <div>
      <div ref={ref} data-testid="alphatab" />
      {error && <p className="m-0 text-(--danger)">{error}</p>}
    </div>
  );
}
