'use client';

/**
 * The artist and credits (issue #202), opened by a press on them in the score's head, or on the
 * space under the title when there are none: Artist, Words and Music, each optional. "Same people
 * wrote both" folds Music into Words, as the head prints one "Words & Music by" line. The head
 * follows what is typed; Enter or a press away keeps it as one undo step, Esc puts it back.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Clip } from './clip';
import { headerValue, setCredit } from './credits';
import { usePopover } from './usePopover';
import { Toggle } from './ViewOptions';

export function CreditsPanel({ clip, x, y, onChange, onDone }: {
  /** The clip as it was when the panel opened. */
  clip: Clip;
  x: number;
  y: number;
  /** The clip as typed so far, shown while the panel is open. */
  onChange: (clip: Clip) => void;
  /** Closed: the clip to keep, or null to put it back as it was (Esc). */
  onDone: (clip: Clip | null) => void;
}) {
  const [artist, setArtist] = useState(headerValue(clip, 'artist') ?? '');
  const [words, setWords] = useState(headerValue(clip, 'words') ?? '');
  const [music, setMusic] = useState(headerValue(clip, 'music') ?? '');
  // On when one set of people wrote both, or nobody is named yet: most songs credit the band for both.
  const [same, setSame] = useState(words === music);

  const typed = (next: { artist?: string; words?: string; music?: string; same?: boolean }) => {
    const a = next.artist ?? artist;
    const w = next.words ?? words;
    const both = next.same ?? same;
    const m = both ? w : (next.music ?? music);
    return setCredit(setCredit(setCredit(clip, 'artist', a), 'words', w), 'music', m);
  };
  const latest = useRef(clip);
  const show = (next: Parameters<typeof typed>[0]) => {
    latest.current = typed(next);
    onChange(latest.current);
  };

  const done = useRef(false);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(keep ? latest.current : null);
  };
  const { ref, style } = usePopover({ x, y, focus: 'input', onClose: () => finish(true) });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // The page's own keys (Space plays) stay out of the fields.
    e.stopPropagation();
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) finish(true);
    else if (e.key === 'Escape') finish(false);
  };

  return createPortal(
    // Its keys are the fields' own: Enter keeps, Esc puts back.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div ref={ref} role="dialog" aria-label="Artist and credits" className="shape-menu tab-head-panel" style={style} tabIndex={-1} onKeyDown={onKeyDown}>
      <Field label="Artist" value={artist} onChange={v => { setArtist(v); show({ artist: v }); }} />
      <Field label={same ? 'Words & Music' : 'Words'} value={words} onChange={v => { setWords(v); show({ words: v }); }} />
      {!same && <Field label="Music" value={music} onChange={v => { setMusic(v); show({ music: v }); }} />}
      <Toggle
        label="Same people wrote both" on={same}
        onChange={on => {
          // Turned off, Music starts as Words has it; turned on, Music follows Words again.
          setMusic(words);
          setSame(on);
          show({ same: on, music: words });
        }}
      />
    </div>,
    document.body,
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="tab-time-caption">{label} (optional)</span>
      <input className="input tab-head-input" aria-label={`${label} (optional)`} value={value} maxLength={200} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
