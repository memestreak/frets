import { useCallback, useState } from 'react';
import { barErrors, MAX_CAPO, type Part } from './clip';
import { columnAt, type Cursor } from './editing';
import { setBarKey, setBarTime, setPickup, setBeatText, setCapo, setChordName, setEnding, setRepeatTimes, setSection } from './barEdits';
import { BarKeyPanel } from './BarKeyPanel';
import { BarFixPopover } from './BarFixPopover';
import { BarTimePanel } from './BarTimePanel';
import { CreditsPanel, type HeadField } from './CreditsPanel';
import { barTempoSpot, barTimeSpot, PANEL_DROP, PANEL_LEAD, wordNow, wordSpot } from './fieldSpots';
import { SPLITS_TUPLET } from './timeline';
import type { Layout } from './layout';
import { TempoPanel } from './TempoPanel';
import { TuningPanel } from './TuningPanel';
import type { EditorState } from './useEditorState';
import { WordField, type FieldKind } from './WordField';

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
  /** The chord name, text, section, tempo or capo being typed, and where: the cursor's column or bar when it opened. */
  const [word, setWord] = useState<{ kind: FieldKind; bar: number; column: number } | null>(null);
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
    // A chord name or text belongs to a column; an empty bar has none yet.
    if ((kind === 'chord' || kind === 'text') && !columnAt(clip, at)) return;
    // The capo belongs to the whole clip, written over its first line.
    if (kind === 'capo') setWord({ kind, bar: 0, column: 0 });
    else setWord({ kind, bar: at.bar, column: at.column });
  };

  /** A typed chord name, text, section or capo set (an empty one clears it); null leaves it as it was. */
  const finishWord = (value: string | null, byKey: boolean) => {
    const w = word;
    setWord(null);
    // After Enter or Esc the keys go back to the tab; leaving the field leaves the focus where it went.
    if (byKey) editorRef.current?.focus();
    if (!w || value === null) return;
    if (w.kind === 'chord') commit(setChordName(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'text') commit(setBeatText(clip, { bar: w.bar, column: w.column, string: cursor.string }, value));
    if (w.kind === 'section') commit(setSection(clip, w.bar, value));
    // An ending of 0, or none, takes the bracket away.
    if (w.kind === 'ending') commit(setEnding(clip, w.bar, Number(value) || null));
    // A count under 2, or none, is played twice, written without one.
    if (w.kind === 'repeat') commit(setRepeatTimes(clip, w.bar, Number(value) || 2));
    // A capo of 0 is no capo.
    if (w.kind === 'capo') commit(setCapo(clip, value === '' || Number(value) === 0 ? null : Math.min(MAX_CAPO, Number(value))));
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

  const { tab, drawn } = shown;
  // Only while a popover is open: what its bar's ⚠ says.
  const fixText = fixBar ? barErrors(clip).get(fixBar.bar) : undefined;
  const panels = (
    <>
      {tab && word && drawn && (
        <WordField
          key={`${word.kind}-${word.bar}-${word.column}`} kind={word.kind} {...wordSpot(layout, width, word)}
          initial={wordNow(clip, word)} onDone={finishWord}
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
          onPickup={length => commitReBar(setPickup(clip, length), 0)} onClose={closeTimeBar}
        />
      )}
    </>
  );

  return {
    openWord, openSignature, openFix, closeSignatures, closeAll, panels,
    /** The score head's panels, from a press on the head (or the folded title), at that spot. */
    openCredits: (x: number, y: number, field: HeadField) => setHeadPanel({ kind: 'credits', x, y, from: clip, field }),
    openTuning: (x: number, y: number) => setHeadPanel({ kind: 'tuning', x, y }),
    openHeadTempo: (x: number, y: number) => setHeadPanel({ kind: 'tempo', x, y, from: clip, bar: 0, fromTab: false }),
  };
}
