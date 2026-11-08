import { useState } from 'react';
import type { Clip, Part } from './clip';
import { DEFAULT_FX } from './effects';
import { columnAt, columnCount, growSelection, indexOf, selectedRange, type Cursor, type Selection } from './editing';
import { rollsOf, usePlayback } from './PlaybackFooter';
import type { Sound } from './playback';
import type { TabPrefs } from './tabSettings';
import type { EditorState } from './useEditorState';

/**
 * Playback of the shown track, and where it plays: the playback line, the columns Play starts at and stops
 * after, and Loop. The line is put on a column by a press above or below the staff (Jeremy, 2026-10-26); it
 * holds until the clip, the cursor or the selection changes. Play starts there, else at the selection's
 * first column, else the cursor's, else the first; Loop takes the selection.
 */
export function usePlayRange(editor: EditorState, { whole, wholeWith, sound, settings, metronome, replace }: {
  /** The whole clip, every track: the line holds only while it stays the same. */
  whole: Clip;
  /** The whole clip with an edit of the shown track in it; the same clip for no edit. */
  wholeWith: (part: Part) => Clip;
  /** The clip's own instrument, or the nearest of Frets' sounds to it (`instrument.ts`). */
  sound: Sound;
  /** Settings' Playback and Metronome sections. */
  settings: TabPrefs['playback'];
  metronome: TabPrefs['metronome'];
  /** Puts an edited whole clip in, as one undo step. */
  replace: (next: Clip) => void;
}) {
  const { clip, cursor, cursorAsSet, selection, selectionAsSet, setSelection, tabFocused, editorRef, startRegion, setNotice } = editor;
  const [playMark, setPlayMark] = useState<{ index: number; clip: Clip; cursor: Cursor; selection: Selection | null } | null>(null);
  const playback = usePlayback(clip, sound, settings.volume, {
    loopPause: settings.loopPause ? settings.loopPauseSeconds : 0,
    transpose: settings.transpose,
    metronome: metronome.on,
    countIn: metronome.countIn,
    countInBars: metronome.countInBars,
    clickVolume: metronome.clickVolume,
    effects: clip.fx ?? DEFAULT_FX,
    rolls: rollsOf(settings),
    // With "Stop leaves the cursor where it stopped" (Jeremy, 2026-10-27), the playback line goes
    // where the playhead was, so the next Play goes on from there; else everything stays as before Play.
    // The line moving lets any selection go, as every other move of it does (Jeremy, 2026-10-28).
    onStopAt: column => {
      if (!settings.stopAtPlayhead) return;
      setSelection(null);
      setPlayMark({ index: column, clip: whole, cursor: cursorAsSet, selection: null });
    },
  });

  const count = columnCount(clip);
  const selectedColumns = selection ? selectedRange(selection) : null;
  /** The playback line's gap while it holds, else null. */
  const markAt = playMark && playMark.clip === whole && playMark.cursor === cursorAsSet && playMark.selection === selectionAsSet
    ? playMark.index : null;
  // Else Play starts at the selection, else the loop points' start (Loop lets the selection go once it
  // takes it), else the cursor; with no cursor on the tab, from the beginning. A line past the clip's
  // end plays its last column.
  const loopStart = Array.isArray(playback.loop) ? playback.loop[0] : null;
  const playFrom = markAt !== null ? Math.min(markAt, count - 1)
    : selectedColumns ? selectedColumns[0]
    : loopStart !== null ? loopStart
    : tabFocused ? indexOf(clip, cursor.bar, cursor.column) : 0;
  // "Stop playback at region end" (Jeremy, 2026-10-28): with a region selected, Play stops after its
  // last column, unless it starts past it. A loop still goes round instead.
  const playUntil = settings.stopAtRegionEnd && selectedColumns && playFrom <= selectedColumns[1] ? selectedColumns[1] : null;
  /**
   * Loop, the button or L: the loop points go round the selection, which then goes (Jeremy, 2026-11-05),
   * else round the whole clip; or they go. The tab lets the keys go too, as when the playhead moves, so
   * nothing stays lit; Space then plays from the loop's start.
   */
  const toggleLoop = () => {
    const next = playback.toggleLoop(selectedColumns);
    if (!Array.isArray(next)) return;
    setSelection(null);
    if (tabFocused) editorRef.current?.blur();
  };
  /**
   * A press above or below the staff: the playback line goes there (while playing, playback jumps
   * there), and any selection goes. With Shift, the columns from the line (else the selection's
   * anchor, else the cursor) to there are selected, with no string picked (Jeremy, 2026-10-27).
   */
  const pickColumn = (gap: number, extend: boolean) => {
    if (extend) {
      // From the line, the columns between it and the gap pressed (Jeremy, 2026-10-28: one column, not two);
      // from a selection or the cursor, grown to the column beside the gap (issue #366): the one before it when the gap is after.
      if (markAt !== null) {
        if (gap !== markAt) setSelection(gap > markAt ? { anchor: markAt, focus: gap - 1 } : { anchor: markAt - 1, focus: gap });
        return;
      }
      const from = selection ?? (tabFocused && columnAt(clip, cursor) ? { anchor: indexOf(clip, cursor.bar, cursor.column), focus: indexOf(clip, cursor.bar, cursor.column) } : null);
      if (from !== null) {
        const end = selectedRange(from)[1];
        setSelection(growSelection(from, from.anchor, gap > end ? gap - 1 : gap));
        startRegion();
        return;
      }
    }
    const index = Math.min(gap, count);
    // Moving the playhead lets the selection go, while playing too (Jeremy, 2026-10-27); loop points stay.
    setSelection(null);
    // ...and the tab's cursor: the tab lets the keys go, as after a press beside the bars (Jeremy, 2026-10-28).
    if (tabFocused) editorRef.current?.blur();
    if (playback.seek(index)) return;
    setPlayMark({ index, clip: whole, cursor: cursorAsSet, selection: null });
  };
  /** Puts the playback line at a gap, or takes it away; it holds until the clip, the cursor or the selection changes. */
  const placeLine = (index: number | null) => setPlayMark(index === null ? null : { index, clip: whole, cursor: cursorAsSet, selection: null });
  /** Takes the playback line away. */
  const dropLine = () => setPlayMark(null);
  /** An edit made off the tab, from the playback line: one undo step, the line held at a gap of the new clip. */
  const editAtLine = (next: Part, index: number) => {
    const edited = wholeWith(next);
    if (edited !== whole) replace(edited);
    setSelection(null);
    setNotice(null);
    setPlayMark({ index, clip: edited, cursor: cursorAsSet, selection: null });
  };

  return { playback, selectedColumns, markAt, playFrom, playUntil, toggleLoop, pickColumn, placeLine, dropLine, editAtLine };
}

export type PlayRange = ReturnType<typeof usePlayRange>;
