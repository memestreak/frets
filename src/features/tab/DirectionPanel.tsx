'use client';

import { useRef } from 'react';
import { usePanelClose, usePanelInside } from './barPanel';
import { DirectionMark } from './ClipWords';
import { DIRECTION_LOOKS, directionName, directionParts, directionsAt, OFFERED_DIRECTIONS, type DirectionName } from './directions';
import type { Part } from './clip';

/** The height of a Direction's picture on its toggle: a Coda sign's, with a little room. */
const PICTURE_HEIGHT = 26;

/**
 * The Direction panel (issue #496): a bar's Directions as toggles, each drawn as it is drawn over the
 * tab, opened at the bar by the Bars palette's Direction button, the bar's right-click menu, or a
 * picked Direction's Edit. Those at the bar's start (Segno, Coda) first, then those at its end; a bar's
 * Direction the panel doesn't offer (a double Segno or Coda) is listed too, so it can be taken away.
 * Each toggle changes the clip at once; Esc or a press elsewhere closes it, as the key signature's does.
 */
export function DirectionPanel({ clip, bar, x, y, onToggle, onClose }: {
  clip: Part;
  bar: number;
  x: number;
  y: number;
  onToggle: (name: DirectionName) => void;
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  usePanelInside(boxRef, x);
  usePanelClose(boxRef, onClose);
  const now = directionsAt(clip, bar);
  const listed = [...OFFERED_DIRECTIONS, ...now.filter(name => !OFFERED_DIRECTIONS.includes(name))];
  const group = (at: 'start' | 'end') => listed.filter(name => DIRECTION_LOOKS[name].at === at);
  const caption = `Directions in bar ${bar + 1}`;
  return (
    <div ref={boxRef} className="tab-bar-time card tab-directions" style={{ left: x, top: y }} role="dialog" aria-label={caption}>
      <span className="tab-bar-time-title">{caption}</span>
      {(['start', 'end'] as const).map(at => (
        <div key={at} className="tab-directions-group" role="group" aria-label={at === 'start' ? 'At the start of the bar' : 'At the end of the bar'}>
          <span className="tab-directions-label">{at === 'start' ? 'Start of the bar' : 'End of the bar'}</span>
          <div className="tab-directions-list">
            {group(at).map(name => {
              const { width } = directionParts(name);
              return (
                <button
                  key={name} type="button" className="btn btn-secondary btn-toggle tab-direction-toggle" aria-pressed={now.includes(name)}
                  aria-label={directionName(name)} title={directionName(name)} onClick={() => onToggle(name)}
                >
                  <svg width={width + 2} height={PICTURE_HEIGHT} viewBox={`-1 0 ${width + 2} ${PICTURE_HEIGHT}`} aria-hidden="true">
                    <DirectionMark name={name} x={0} y={PICTURE_HEIGHT / 2 + 1} ink="currentColor" picture />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
