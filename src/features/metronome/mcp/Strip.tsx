/**
 * MOCK B for the MCP App (Jeremy, 2026-10-31: "scale the UI to better suit" Claude's chat): the
 * metronome in one row. The pads, then the tempo with − and +, Start, Tap and Beats; Sound and
 * Volume move into Advanced. No title and no view switch.
 */
import { Advanced } from '../Advanced';
import { BeatsField, PlayButton, SoundControls, TapButton, useBpmDrag } from '../controls';
import { MAX_BPM, MIN_BPM, clampBpm, tempoName } from '../rhythm';
import type { Metronome } from '../useMetronomeCore';
import { BeatPads } from '../views';

export function Strip({ m }: { m: Metronome }) {
  const drag = useBpmDrag(m);
  const { bpm } = m.rhythm;
  const nudge = (by: number) => m.setRhythm(r => ({ ...r, bpm: clampBpm(r.bpm + by) }));
  return (
    <section className="card metronome-card mcp-strip" aria-label="Metronome">
      <BeatPads m={m} />
      <div className="mcp-strip-row">
        <button type="button" className="btn btn-ghost metronome-nudge" aria-label="Slower" data-tip="1 bpm slower" onClick={() => nudge(-1)}>−</button>
        <div
          className="metronome-big metronome-bpm-drag" role="slider" tabIndex={0} aria-label="Tempo"
          aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={bpm} aria-valuetext={`${bpm} bpm`}
          data-tip="Drag up or down: 5 bpm a step, 1 with Shift. Double-click: 120" {...drag}
          onKeyDown={e => {
            const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
            if (by === undefined) return;
            e.preventDefault();
            nudge(by * (e.shiftKey ? 1 : 5));
          }}
        >
          <span className="metronome-big-number">{bpm}</span>
          <span className="metronome-big-unit">bpm · {tempoName(bpm)}</span>
        </div>
        <button type="button" className="btn btn-ghost metronome-nudge" aria-label="Faster" data-tip="1 bpm faster" onClick={() => nudge(1)}>+</button>
        <PlayButton m={m} />
        <TapButton m={m} />
        <BeatsField m={m} />
      </div>
      <Advanced m={m} first={<div className="metronome-row"><SoundControls m={m} /></div>} />
    </section>
  );
}
