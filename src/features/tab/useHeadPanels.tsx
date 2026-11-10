import { useCallback, useMemo, useState } from 'react';
import { barErrors, dynamicOf, MAX_CAPO, type Part } from './clip';
import { columnAt, indexOf, withRestsInEmptyBars, type Cursor } from './editing';
import { setBarKey, setBarTime, setBeatGroups, setPickup, setBeatText, setCapo, setChordName, setDynamic, setEnding, setRepeatTimes, setSection } from './barEdits';
import { BarKeyPanel } from './BarKeyPanel';
import { BarFixPopover } from './BarFixPopover';
import { BarTimePanel } from './BarTimePanel';
import { CreditsPanel, type HeadField } from './CreditsPanel';
import { barTempoSpot, barTimeSpot, lyricSpot, PANEL_DROP, PANEL_LEAD, wordNow, wordSpot } from './fieldSpots';
import { LyricField, type LyricNudge } from './LyricField';
import { lyricAt, lyricNote, lyricValue, MAX_LYRIC_LINES, setLyric, type LyricMove } from './lyrics';
import { SPLITS_TUPLET } from './timeline';
import type { Layout } from './layout';
import type { Typing } from './ClipWords';
import { TempoPanel } from './TempoPanel';
import { TuningPanel } from './TuningPanel';
import type { EditorState } from './useEditorState';
import { WordField, type FieldKind } from './WordField';
import { chordStep, type ChordMove } from './chordPopover';

/**
 * The score head's open panel and where it was pressed, in viewport pixels; the title and credits'
 * and the tempo's hold the clip as it opened, the undo step their changes become (the credits' also
 * the field the press focuses). A tempo panel opened from the tab (the Tempo tool, a picked tempo's
 * Edit) gives the keys back to the tab when it closes.
 */
type HeadPanel =
  | { kind: 'credits'; x: number; y: number; from: Part; field: HeadField }
  | { kind: 'tuning'; x: number; y: number }
  | { kind: 'tempo'; x: number; y: number; from: Part; bar: number; fromTab: boolean };

/**
 * The fields and panels opened over the drawn tab (a chord name's field, a bar's time or key signature)
 * and from the score's head (title and credits, tuning, tempo): which one is open, where, and what
 * closing it keeps. `panels` draws the open one; the page puts it over the drawing.
 */
export function useHeadPanels(editor: EditorState, { layout, width, zoom, shown }: {
  /** The drawn clip's layout, and its width in the drawing's units. */
  layout: Layout;
  width: number;
  /** The Size, which zooms the drawing. */
  zoom: number;
  /** Whether the drawn tab is shown (the Notation view), and has a width yet. */
  shown: { tab: boolean; drawn: boolean };
}) {
  const { clip, cursor, commit, commitReBar, dispatch, editorRef, setNotice } = editor;
  /**
   * The chord name, text, section, tempo or capo being typed, and where: the cursor's column or bar when it opened.
   * The chord popover's `turn` counts its moves, so a move that stays put (past the clip's end) opens it afresh.
   */
  const [word, setWord] = useState<{ kind: FieldKind; bar: number; column: number; turn?: number } | null>(null);
  /** The note whose syllable the Lyrics field is typing, and its Lyric line (issue #408). */
  const [lyric, setLyricField] = useState<{ bar: number; column: number; line: number; turn?: number } | null>(null);
  /** Where the Lyrics field was dragged to, kept while it goes note to note; it opens over the note again next time. */
  const [lyricNudge, setLyricNudge] = useState<LyricNudge>({ dx: 0, dy: 0 });
  /**
   * The syllable drawn in the typing colour while the field is open: the one the field set last, so what was
   * just typed shows (Dorico's last lyric, in its selection colour). The field's own note is drawn selected.
   */
  const [lyricLit, setLyricLit] = useState<{ bar: number; column: number; line: number } | null>(null);
  /** The bar whose time signature panel is open. */
  const [timeBar, setTimeBar] = useState<number | null>(null);
  /** The bar whose key signature panel is open. */
  const [keyBar, setKeyBar] = useState<number | null>(null);
  /** Where a press opened the time or key signature panel; null when the palette did. */
  const [panelAt, setPanelAt] = useState<{ x: number; y: number } | null>(null);
  const [headPanel, setHeadPanel] = useState<HeadPanel | null>(null);
  /** The Uneven bar whose ⚠ was pressed, and where: its popover holds the fix. */
  const [fixBar, setFixBar] = useState<{ bar: number; x: number; y: number } | null>(null);

  /**
   * The tempo panel from the tab: the first bar's under the head's tempo, as a press on it opens it;
   * a later bar's just under where its tempo is drawn.
   */
  const openTempo = (bar: number) => {
    const head = bar === 0 ? document.querySelector('.score-tempo-button') : null;
    const box = head ? null : editorRef.current?.getBoundingClientRect();
    let at = { x: 0, y: 0 };
    if (head) {
      const r = head.getBoundingClientRect();
      at = { x: r.left, y: r.bottom + 4 };
    } else if (box) {
      // The drawing's units are zoomed by Size.
      const spot = barTempoSpot(layout, bar);
      at = { x: box.left + spot.x * zoom, y: box.top + spot.y * zoom };
    }
    setHeadPanel({ kind: 'tempo', ...at, from: clip, bar, fromTab: true });
  };

  /** Opens a word's field (a tempo's panel) at the cursor, or at `at`. */
  const openWord = (kind: FieldKind | 'tempo', at: Cursor = cursor) => {
    if (kind === 'tempo') {
      openTempo(at.bar);
      return;
    }
    // Text belongs to a column; an empty bar has none yet.
    if (kind === 'text' && !columnAt(clip, at)) return;
    // A chord name or a dynamic can go on an empty bar too: it lands on the first of the rests that fill it (P1).
    if ((kind === 'chord' || kind === 'dynamic') && !columnAt(clip, at)) {
      if (clip.bars[at.bar]?.columns.length !== 0) return;
      setWord({ kind, bar: at.bar, column: 0 });
      return;
    }
    // The capo belongs to the whole clip, written over its first line.
    if (kind === 'capo') setWord({ kind, bar: 0, column: 0 });
    else setWord({ kind, bar: at.bar, column: at.column });
  };

  /**
   * The chord popover's name set on its spot (an empty bar filled with its rests first), then the popover
   * moved on as its key says (issue #342). Esc (null) leaves the spot as it was and closes it.
   */
  const finishChord = (at: { bar: number; column: number; turn?: number }, value: string | null, byKey: boolean, move?: ChordMove) => {
    const place = { ...cursor, bar: at.bar, column: at.column };
    let next = clip;
    if (value !== null && value.trim() !== (clip.bars[at.bar]?.columns[at.column]?.chord ?? '')) {
      const base = columnAt(clip, place) ? clip : value.trim() ? withRestsInEmptyBars(clip) ?? clip : clip;
      next = setChordName(base, place, value);
    }
    const to = move && value !== null ? chordStep(next, at, move) ?? at : null;
    if (!to) {
      setWord(null);
      if (next !== clip) commit(next, columnAt(next, place) ? place : cursor);
      // After Enter or Esc the keys go back to the tab; leaving the field leaves the focus where it went.
      if (byKey) editorRef.current?.focus();
      return;
    }
    // The cursor follows the popover, so what it is over shows; a bar still empty keeps it on the bar.
    commit(next, { ...cursor, bar: to.bar, column: to.column }, null);
    setWord({ kind: 'chord', ...to, turn: (at.turn ?? 0) + 1 });
  };

  /** A typed chord name, text, section or capo set (an empty one clears it); null leaves it as it was. */
  const finishWord = (value: string | null, byKey: boolean, move?: ChordMove) => {
    const w = word;
    if (w?.kind === 'chord') {
      finishChord(w, value, byKey, move);
      return;
    }
    setWord(null);
    // After Enter or Esc the keys go back to the tab; leaving the field leaves the focus where it went.
    if (byKey) editorRef.current?.focus();
    if (!w || value === null) return;
    if (w.kind === 'text') commit(setBeatText(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'section') commit(setSection(clip, w.bar, value));
    // The field lets only a dynamic or nothing through; nothing takes it away.
    if (w.kind === 'dynamic') {
      const place = { bar: w.bar, column: w.column, string: cursor.string };
      // An empty bar is filled with its rests first, so the dynamic has a column to go on.
      const base = columnAt(clip, place) ? clip : withRestsInEmptyBars(clip) ?? clip;
      const next = setDynamic(base, place, dynamicOf(value));
      if (next !== base) commit(next, place);
    }
    // An ending of 0, or none, takes the bracket away.
    if (w.kind === 'ending') commit(setEnding(clip, w.bar, Number(value) || null));
    // A count under 2, or none, is played twice, written without one.
    if (w.kind === 'repeat') commit(setRepeatTimes(clip, w.bar, Number(value) || 2));
    // A capo of 0 is no capo.
    if (w.kind === 'capo') commit(setCapo(clip, value === '' || Number(value) === 0 ? null : Math.min(MAX_CAPO, Number(value))));
  };

  /**
   * Opens the Lyrics field on the note at `at`, or the next one that takes a syllable (Shift+L, the Lyrics
   * tool, a picked syllable's Edit); with none after it, nothing opens.
   */
  const openLyric = (at: { bar: number; column: number }, line = 0) => {
    const place = lyricNote(clip, at, 0);
    if (!place) {
      setNotice({ tone: 'info', lines: ['Lyrics go under notes: there is no note here or after it.'] });
      return;
    }
    setWord(null);
    commit(clip, { ...cursor, ...place }, null);
    if (!lyric) setLyricNudge({ dx: 0, dy: 0 });
    setLyricLit(null);
    setLyricField({ ...place, line });
  };

  /** A syllable set (Esc leaves it), then the field moves on as its key says, or closes. */
  const finishLyric = (typed: string, move: LyricMove, byKey: boolean) => {
    const at = lyric;
    if (!at) return;
    const next = move === 'cancel' ? clip : setLyric(clip, at, at.line, lyricValue(typed, move));
    const step = move === 'next' || move === 'hyphen' ? 1 : move === 'back' ? -1 : null;
    // Past the first or last note the field stays on this one, so what is typed next still goes into it.
    const place = step ? lyricNote(next, at, step) ?? at : move === 'up' || move === 'down' ? at : null;
    const line = move === 'down' ? Math.min(MAX_LYRIC_LINES - 1, at.line + 1) : move === 'up' ? Math.max(0, at.line - 1) : at.line;
    commit(next, { ...cursor, ...(place ?? at) }, null);
    if (place) {
      // A new turn opens the field afresh even on the same note, with what it now has.
      setLyricField({ ...place, line, turn: (at.turn ?? 0) + 1 });
      // What this key set, else (cleared, or Esc) nothing.
      setLyricLit(move !== 'cancel' && lyricAt(next, at, at.line) ? { bar: at.bar, column: at.column, line: at.line } : null);
      return;
    }
    setLyricField(null);
    setLyricLit(null);
    if (byKey) editorRef.current?.focus();
  };

  /** A bar's time or key signature panel: under a press (`at`, viewport pixels), or from the palette (null) under the bar. */
  const openSignature = (kind: 'time' | 'key', bar: number, at: { x: number; y: number } | null) => {
    setPanelAt(at);
    (kind === 'time' ? setTimeBar : setKeyBar)(bar);
  };
  /** An Uneven bar's popover, just under the press on its ⚠ (`at`, in the drawing's units). */
  const openFix = (bar: number, at: { x: number; y: number }) => {
    closeSignatures();
    setFixBar({ bar, x: at.x - PANEL_LEAD, y: at.y + PANEL_DROP });
  };
  const closeFix = useCallback((byKey: boolean) => {
    setFixBar(null);
    if (byKey) editorRef.current?.focus();
  }, [editorRef]);
  /** The fix made, and the popover let go of (let go after use); a fix that would split a tuplet is refused. */
  const finishFix = (fixed: Part | null) => {
    setFixBar(null);
    editorRef.current?.focus();
    if (fixed) commit(fixed);
    else setNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
  };
  /** Shuts both signature panels: a right-click menu opens in their place. */
  const closeSignatures = () => {
    setTimeBar(null);
    setKeyBar(null);
  };
  /** Shuts whatever is open: another track is shown. */
  const closeAll = () => {
    setWord(null);
    setLyricField(null);
    setLyricLit(null);
    setHeadPanel(null);
    setFixBar(null);
    closeSignatures();
  };

  const closeTimeBar = useCallback((byKey: boolean) => {
    setTimeBar(null);
    if (byKey) editorRef.current?.focus();
  }, [editorRef]);
  const closeKeyBar = useCallback((byKey: boolean) => {
    setKeyBar(null);
    if (byKey) editorRef.current?.focus();
  }, [editorRef]);

  /** The tempo as set: shown at once, kept as one undo step when the panel closes, or put back. */
  const finishTempo = (from: Part, kept: Part | null, fromTab: boolean) => {
    setHeadPanel(null);
    if (kept && kept !== from) dispatch({ type: 'replacePart', part: kept, from });
    else dispatch({ type: 'previewPart', part: from });
    if (fromTab) editorRef.current?.focus();
  };
  /** The title and credits as typed: shown at once, kept as one undo step when the panel closes, or put back. */
  const finishCredits = (from: Part, kept: Part | null) => {
    setHeadPanel(null);
    if (kept && kept !== from) dispatch({ type: 'replacePart', part: kept, from });
    else dispatch({ type: 'previewPart', part: from });
  };

  // One object while nothing in it changes, so the drawing (memoised) isn't drawn again for nothing.
  const typing = useMemo((): Typing | null => {
    if (!lyric || lyric.bar >= clip.bars.length) return null;
    const lit = lyricLit && lyricLit.bar < clip.bars.length ? lyricLit : null;
    return {
      note: indexOf(clip, lyric.bar, lyric.column),
      hit: lit ? { kind: 'lyric', index: indexOf(clip, lit.bar, lit.column), line: lit.line } : null,
    };
  }, [lyric, lyricLit, clip]);

  const { tab, drawn } = shown;
  // Only while a popover is open: what its bar's ⚠ says.
  const fixText = fixBar ? barErrors(clip).get(fixBar.bar) : undefined;
  const panels = (
    <>
      {tab && word && drawn && (
        <WordField
          key={`${word.kind}-${word.bar}-${word.column}-${word.turn ?? 0}`} kind={word.kind} {...wordSpot(layout, width, word)}
          initial={wordNow(clip, word)} onDone={finishWord}
        />
      )}
      {tab && lyric && drawn && (
        <LyricField
          key={`lyric-${lyric.bar}-${lyric.column}-${lyric.line}-${lyric.turn ?? 0}`} line={lyric.line} {...lyricSpot(layout, width, lyric)}
          nudge={lyricNudge} onNudge={setLyricNudge} zoom={zoom}
          initial={lyricAt(clip, lyric, lyric.line)} onDone={finishLyric}
        />
      )}
      {tab && keyBar !== null && keyBar < clip.bars.length && drawn && (
        <BarKeyPanel
          clip={clip} bar={keyBar} {...(panelAt ?? barTimeSpot(layout, keyBar))}
          onChange={key => commit(setBarKey(clip, keyBar, key))} onClose={closeKeyBar}
        />
      )}
      {tab && headPanel?.kind === 'credits' && (
        <CreditsPanel
          clip={headPanel.from} x={headPanel.x} y={headPanel.y} field={headPanel.field}
          onChange={next => dispatch({ type: 'previewPart', part: next })} onDone={kept => finishCredits(headPanel.from, kept)}
        />
      )}
      {tab && headPanel?.kind === 'tempo' && (
        <TempoPanel
          clip={headPanel.from} bar={headPanel.bar} x={headPanel.x} y={headPanel.y}
          onChange={next => dispatch({ type: 'previewPart', part: next })} onDone={kept => finishTempo(headPanel.from, kept, headPanel.fromTab)}
        />
      )}
      {tab && headPanel?.kind === 'tuning' && (
        <TuningPanel clip={clip} x={headPanel.x} y={headPanel.y} onChange={commit} onClose={() => setHeadPanel(null)} />
      )}
      {tab && fixBar !== null && fixText !== undefined && drawn && (
        <BarFixPopover clip={clip} bar={fixBar.bar} text={fixText} x={fixBar.x} y={fixBar.y} onFix={finishFix} onClose={closeFix} />
      )}
      {tab && timeBar !== null && timeBar < clip.bars.length && drawn && (
        <BarTimePanel
          clip={clip} bar={timeBar} {...(panelAt ?? barTimeSpot(layout, timeBar))}
          onChange={time => commitReBar(setBarTime(clip, timeBar, time), timeBar)}
          onPickup={length => commitReBar(setPickup(clip, length), 0)}
          onGroups={counts => commitReBar(setBeatGroups(clip, timeBar, counts), timeBar)} onClose={closeTimeBar}
        />
      )}
    </>
  );

  return {
    openWord, openLyric, openSignature, openFix, closeSignatures, closeAll, panels,
    /** While the Lyrics field is open: its note, tinted, and the syllable drawn in the typing colour. */
    typing,
    /** The score head's panels, from a press on the head (or the folded title), at that spot. */
    openCredits: (x: number, y: number, field: HeadField) => setHeadPanel({ kind: 'credits', x, y, from: clip, field }),
    openTuning: (x: number, y: number) => setHeadPanel({ kind: 'tuning', x, y }),
    openHeadTempo: (x: number, y: number) => setHeadPanel({ kind: 'tempo', x, y, from: clip, bar: 0, fromTab: false }),
  };
}
