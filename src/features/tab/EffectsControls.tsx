'use client';

/**
 * The playback effects' controls (issue #199), after Sound in the playback row: distortion and
 * reverb (`effects.ts`). Three mocks to pick from, behind `?mock=`:
 *   a (the default) — two knobs, Drive and Reverb, like the Volume knob; Reverb sets the ring's
 *     length too, short at low settings (`reverbDecay`);
 *   b — an Effects button that opens a small panel: Drive and Tone, Reverb and Decay;
 *   c — an Amp list of presets (Clean, Crunch, Lead, High gain) and a Reverb knob, as a's.
 */
import { useState, useSyncExternalStore } from 'react';
import { DECAY_SECONDS, reverbDecay, type EffectSettings } from './effects';
import { NumberField } from './NumberField';
import { usePopover } from './usePopover';
import { VolumeKnob } from './VolumeKnob';

export type EffectsMock = 'a' | 'b' | 'c';

/** The mock in the address (`?mock=b`), else a. */
export function effectsMockFrom(search: string): EffectsMock {
  const mock = new URLSearchParams(search).get('mock');
  return mock === 'b' || mock === 'c' ? mock : 'a';
}

/** The mock this page asks for; a while the static page is drawn, before it reads the address. */
export function useEffectsMock(): EffectsMock {
  return useSyncExternalStore(() => () => undefined, () => effectsMockFrom(window.location.search), () => 'a');
}

/** Mock c's amp presets: how hard each drives, and how bright. */
const AMPS: readonly { name: string; drive: number; tone: number }[] = [
  { name: 'Clean', drive: 0, tone: 0.5 },
  { name: 'Crunch', drive: 0.3, tone: 0.55 },
  { name: 'Lead', drive: 0.6, tone: 0.6 },
  { name: 'High gain', drive: 0.9, tone: 0.5 },
];

export function EffectsControls({ mock, effects, onEffects }: {
  mock: EffectsMock;
  effects: EffectSettings;
  onEffects: (effects: EffectSettings) => void;
}) {
  const set = (change: Partial<EffectSettings>) => onEffects({ ...effects, ...change });
  if (mock === 'b') return <EffectsButton effects={effects} onEffects={onEffects} />;
  if (mock === 'c') {
    const amp = AMPS.find(a => a.drive === effects.drive && (a.drive === 0 || a.tone === effects.tone)) ?? null;
    return (
      <>
        <label className="tab-sound">
          <span className="text-(--ink-muted)">Amp</span>
          <select className="input tab-amp" aria-label="Amp" value={amp?.name ?? ''} onChange={e => {
            const picked = AMPS.find(a => a.name === e.target.value);
            if (picked) set({ drive: picked.drive, tone: picked.tone });
            e.currentTarget.blur();
          }}>
            {/* A setting saved from another mock that no preset matches. */}
            {!amp && <option value="">Custom</option>}
            {AMPS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </label>
        <Knob name="Reverb" value={effects.reverb} onChange={reverb => set({ reverb, decay: reverbDecay(reverb) })} />
      </>
    );
  }
  return (
    <>
      <Knob name="Drive" value={effects.drive} onChange={drive => set({ drive })} />
      <Knob name="Reverb" value={effects.reverb} onChange={reverb => set({ reverb, decay: reverbDecay(reverb) })} />
    </>
  );
}

/** A knob with its name beside it, as Volume has; 0 reads Off. */
function Knob({ name, value, onChange }: { name: string; value: number; onChange: (value: number) => void }) {
  const id = `tab-${name.toLowerCase()}-label`;
  return (
    <div className="tab-volume">
      <span className="text-(--ink-muted)" id={id}>{name}</span>
      <VolumeKnob value={value} onChange={onChange} labelledBy={id} name={name} valueText={value === 0 ? 'Off' : undefined} />
    </div>
  );
}

/** Mock b: an Effects button, lit while either effect is on, that opens the panel under it. */
function EffectsButton({ effects, onEffects }: { effects: EffectSettings; onEffects: (effects: EffectSettings) => void }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const on = effects.drive > 0 || effects.reverb > 0;
  return (
    <>
      <button
        type="button" className="btn btn-secondary btn-toggle" aria-pressed={on} aria-expanded={at !== null}
        onMouseDown={e => e.preventDefault()}
        onClick={e => {
          if (at) return setAt(null);
          const box = e.currentTarget.getBoundingClientRect();
          setAt({ x: box.left, y: box.bottom + 4 });
        }}
      >
        Effects
      </button>
      {at && <EffectsPanel x={at.x} y={at.y} effects={effects} onEffects={onEffects} onClose={() => setAt(null)} />}
    </>
  );
}

function EffectsPanel({ x, y, effects, onEffects, onClose }: {
  x: number;
  y: number;
  effects: EffectSettings;
  onEffects: (effects: EffectSettings) => void;
  onClose: () => void;
}) {
  const { ref, style } = usePopover({ x, y, focus: '[role="slider"]', onClose: () => onClose() });
  const set = (change: Partial<EffectSettings>) => onEffects({ ...effects, ...change });
  return (
    <div
      ref={ref} role="dialog" aria-label="Effects" className="shape-menu tab-effects" style={style} tabIndex={-1}
    >
      <div className="tab-effects-group">
        <span className="tab-effects-name">Distortion</span>
        <div className="tab-effects-row">
          <Knob name="Drive" value={effects.drive} onChange={drive => set({ drive })} />
          <Knob name="Tone" value={effects.tone} onChange={tone => set({ tone })} />
        </div>
      </div>
      <div className="tab-effects-group">
        <span className="tab-effects-name">Reverb</span>
        <div className="tab-effects-row">
          <Knob name="Amount" value={effects.reverb} onChange={reverb => set({ reverb })} />
          <div className="tab-speed">
            <span className="text-(--ink-muted)">Decay</span>
            <NumberField
              value={effects.decay} min={DECAY_SECONDS.min} max={DECAY_SECONDS.max} step={0.1} decimals={1} unit="s"
              label="Decay (seconds)" upLabel="Longer decay" downLabel="Shorter decay" onChange={decay => set({ decay })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
