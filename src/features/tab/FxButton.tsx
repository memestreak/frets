'use client';

/**
 * The playback FX (issue #199; Jeremy, 2026-10-28): an FX button after Sound that opens the FX
 * dialog, with a small light switch on its right that turns every effect on or off together; its
 * light shows which. The dialog has each effect's own switch and settings: Distortion (Drive,
 * Tone) and Reverb (Amount, Decay). The sound is `effects.ts`.
 */
import { useRef, useState } from 'react';
import { DECAY_SECONDS, type FxSettings } from './effects';
import { NumberField } from './NumberField';
import { usePopover } from './usePopover';
import { Toggle } from './ViewOptions';
import { VolumeKnob } from './VolumeKnob';

/** How soon after a press away closed the dialog a click on FX is that same press, and leaves it shut. */
const PRESSED_AWAY_MS = 500;

export function FxButton({ fx, onFx }: { fx: FxSettings; onFx: (fx: FxSettings) => void }) {
  // Where the dialog opened; null while it is shut.
  const [at, setAt] = useState<{ x: number; y: number; above: number } | null>(null);
  // A press on FX while the dialog is open closes it as a press away, before the click.
  const pressedAway = useRef(0);
  return (
    <div className="tab-fx">
      <button
        type="button" className="tab-fx-open" aria-haspopup="dialog" aria-expanded={at !== null} data-tip="Effects"
        // A press leaves the focus (and so the cursor) on the tab.
        onMouseDown={e => e.preventDefault()}
        onClick={e => {
          if (Date.now() - pressedAway.current < PRESSED_AWAY_MS) return;
          // At the press, under the button, or over it when there is no room under it, so FX and
          // its switch stay in reach.
          const box = e.currentTarget.parentElement!.getBoundingClientRect();
          setAt({ x: e.clientX, y: box.bottom + 4, above: box.top - 4 });
        }}
      >
        FX
      </button>
      <button
        type="button" role="switch" aria-checked={fx.on} aria-label="All effects" className="tab-fx-power"
        data-tip={fx.on ? 'Turn all effects off' : 'Turn all effects on'}
        onMouseDown={e => e.preventDefault()} onClick={() => onFx({ ...fx, on: !fx.on })}
      >
        <span className="tab-fx-light" aria-hidden="true" />
      </button>
      {at && <FxDialog x={at.x} y={at.y} above={at.above} fx={fx} onFx={onFx} onClose={away => {
        if (away) pressedAway.current = Date.now();
        setAt(null);
      }} />}
    </div>
  );
}

function FxDialog({ x, y, above, fx, onFx, onClose }: {
  x: number;
  y: number;
  above: number;
  fx: FxSettings;
  onFx: (fx: FxSettings) => void;
  onClose: (pressedAway: boolean) => void;
}) {
  // The dialog itself takes the focus, so no control shows a focus ring on opening.
  const { ref, style } = usePopover({ x, y, above, onClose });
  const set = (change: Partial<FxSettings>) => onFx({ ...fx, ...change });
  // Switching an effect on while the FX button has them all off switches them back on, so it is heard.
  const enable = (change: Partial<FxSettings>, on: boolean) => set(on ? { ...change, on: true } : change);
  return (
    <div ref={ref} role="dialog" aria-label="Effects" className="shape-menu tab-effects" style={style} tabIndex={-1}>
      <div className="tab-effects-group">
        <Toggle label="Distortion" on={fx.distortionOn} onChange={on => enable({ distortionOn: on }, on)} />
        <div className="tab-effects-row">
          <Knob name="Drive" value={fx.drive} onChange={drive => set({ drive })} />
          <Knob name="Tone" value={fx.tone} onChange={tone => set({ tone })} />
        </div>
      </div>
      <div className="tab-effects-group">
        <Toggle label="Reverb" on={fx.reverbOn} onChange={on => enable({ reverbOn: on }, on)} />
        <div className="tab-effects-row">
          <Knob name="Amount" value={fx.reverb} onChange={reverb => set({ reverb })} />
          <div className="tab-speed">
            <span className="text-(--ink-muted)">Decay</span>
            <NumberField
              value={fx.decay} min={DECAY_SECONDS.min} max={DECAY_SECONDS.max} step={0.1} decimals={1} unit="s"
              label="Decay (seconds)" upLabel="Longer decay" downLabel="Shorter decay" onChange={decay => set({ decay })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A knob with its name beside it, as Volume has. */
function Knob({ name, value, onChange }: { name: string; value: number; onChange: (value: number) => void }) {
  const id = `tab-fx-${name.toLowerCase()}-label`;
  return (
    <div className="tab-volume">
      <span className="text-(--ink-muted)" id={id}>{name}</span>
      <VolumeKnob value={value} onChange={onChange} labelledBy={id} name={name} />
    </div>
  );
}
