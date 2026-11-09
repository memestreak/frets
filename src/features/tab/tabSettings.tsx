'use client';

/**
 * The Tab page's preferences (issue #195): each Settings section's saved value, held here as the
 * page's state, and Settings' Tab group built on it. The page's own controls (the footer, Play's and
 * the Metronome's right-click menus, View options, Staff | Tab | Both, the Export dialog) change the
 * same state, so each place always shows what the other set. Sections run most used first (G3).
 */
import { useState } from 'react';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { Segmented } from '@/components/controls';
import { checkField, choiceField } from '@/components/settings/fields';
import { section, type SettingsField, type SettingsGroup } from '@/components/settings/types';
import { NumberField } from '@/components/NumberField';
import { VolumeKnob } from '@/components/VolumeKnob';
import { chooseScheme } from './ViewOptions';
import {
  DEFAULT_METRONOME, DEFAULT_PLAYBACK, MAX_ROLL, MAX_TRANSPOSE, METRONOME_KEY, MIN_ROLL, ROLL_STEP, PLAYBACK_KEY, parseMetronome, parsePlaybackSettings,
  type MetronomeSettings, type PlaybackSettings,
} from './PlaybackFooter';
import { LOOP_PAUSE_STEP, MAX_LOOP_PAUSE, MIN_LOOP_PAUSE } from './PlaybackOptions';
import { MAX_COUNT_IN_BARS } from './playback';
import {
  ALPHATEX_KEY, ASCII_KEY, BAR_NUMBER_NAMES, BAR_NUMBERS, COLOUR_NAMES, COLOURS, COLOURS_KEY, DEFAULT_ALPHATEX, DEFAULT_ASCII,
  DEFAULT_COLOURS, DEFAULT_NOTATION, MAX_SIZE, MIN_SIZE, NOTATION_KEY, SIZE_STEP, parseAlphaTex, parseAscii, parseColours,
  parseNotation, type AlphaTexPrefs, type AsciiPrefs, type ColourPrefs, type Colours, type NotationPrefs,
} from './viewOptions';
import { DEFAULT_TAB_EXPORT, TAB_EXPORT_KEY, TAB_EXPORT_WIDTHS, parseTabExportStyle, type TabExportStyle } from './exportTab';
import { PARTS, type Parts } from './layout';
import { DEFAULT_EDITING, EDITING_KEY, parseEditing, type EditingPrefs } from './editingPrefs';
import { GRID_LOOK_NAMES, GRID_LOOKS, GRID_NAMES, GRID_VALUES, type GridLook, type GridValue } from './grid';
import { CHAT_KEY, DEFAULT_CHAT, parseChatPrefs, type ChatPrefs } from './chat/chatPrefs';
import { customField, instructionsField } from './chat/promptFields';

/** One section's state: read from its key once, written back on every change. */
function usePreference<V>(key: string, parse: (raw: unknown) => V) {
  const [value, setValue] = useState(() => parse(loadJson(key)));
  usePersist(key, value);
  return [value, setValue] as const;
}

/** Every Tab preference, a section at a time, with its setter. */
export function useTabPrefs() {
  const [playback, setPlayback] = usePreference(PLAYBACK_KEY, parsePlaybackSettings);
  const [metronome, setMetronome] = usePreference(METRONOME_KEY, parseMetronome);
  const [notation, setNotation] = usePreference(NOTATION_KEY, parseNotation);
  const [colours, setColours] = usePreference(COLOURS_KEY, parseColours);
  const [ascii, setAscii] = usePreference(ASCII_KEY, parseAscii);
  const [alphatex, setAlphaTex] = usePreference(ALPHATEX_KEY, parseAlphaTex);
  const [editing, setEditing] = usePreference(EDITING_KEY, parseEditing);
  const [exportStyle, setExportStyle] = usePreference(TAB_EXPORT_KEY, parseTabExportStyle);
  const [chat, setChat] = usePreference(CHAT_KEY, parseChatPrefs);
  return {
    playback, setPlayback, metronome, setMetronome, notation, setNotation, colours, setColours,
    ascii, setAscii, alphatex, setAlphaTex, editing, setEditing, exportStyle, setExportStyle, chat, setChat,
  };
}

export type TabPrefs = ReturnType<typeof useTabPrefs>;

/** Settings opens at the Tab group's first section. */
export const TAB_SETTINGS_START = { group: 'tab', section: 'playback' };

/** A number field, as the page's own (Speed, Transpose, the pause, Size). */
function numberField<V, K extends keyof V & string>(key: K, label: string, field: {
  min: number; max: number; step: number; decimals?: number; unit?: string; upLabel: string; downLabel: string;
  /** A longer unit, after the box (as the footer's "semitones"). */
  after?: string;
  /** What is saved from what is typed (a size goes to the nearest step). */
  toValue?: (n: number) => number;
  enabled?: (value: V) => boolean;
}): SettingsField<V> {
  const { toValue = n => n, enabled, after, ...props } = field;
  return {
    key, label, enabled,
    control: ({ value, set, disabled }) => (
      <>
        <NumberField
          {...props} label={label} disabled={disabled} value={value[key] as number}
          onChange={n => set({ ...value, [key]: toValue(n) })}
        />
        {after && <span className="settings-after">{after}</span>}
      </>
    ),
  };
}

/** How long a chord's roll takes, as a percentage of the chord's length (issue #385). */
function rollField(key: 'strokesRoll' | 'strumsRoll' | 'rolledChordsRoll', label: string, enabled: (value: PlaybackSettings) => boolean) {
  return numberField<PlaybackSettings, typeof key>(key, label, {
    min: MIN_ROLL, max: MAX_ROLL, step: ROLL_STEP, decimals: 1, unit: '%',
    upLabel: 'Longer', downLabel: 'Shorter', enabled,
  });
}

/** A volume, 0 to 1, as the footer's knob. */
function knobField<V, K extends keyof V & string>(key: K, label: string): SettingsField<V> {
  return {
    key, label,
    control: ({ value, set, labelId }) => (
      <VolumeKnob value={value[key] as number} labelledBy={labelId} name={label} onChange={v => set({ ...value, [key]: v })} />
    ),
  };
}

/** A yes or no as two named choices, as the Export dialog shows it (On | Off, Show | Hide). */
function twoWayField<V, K extends keyof V & string>(key: K, label: string, yes: string, no: string): SettingsField<V> {
  return {
    key, label,
    control: ({ value, set, disabled }) => (
      <Segmented
        label={label} value={value[key] ? 'yes' : 'no'} options={[['yes', yes], ['no', no]] as const} disabled={disabled}
        onChange={choice => set({ ...value, [key]: choice === 'yes' })}
      />
    ),
  };
}

/** One of Custom's two colours: the browser's colour picker, as View options shows it. */
function colourField(key: 'text' | 'background', label: string): SettingsField<ColourPrefs> {
  return {
    key, label, enabled: v => v.scheme === 'custom',
    control: ({ value, set, labelId, disabled }) => (
      <span className="tab-view-swatch settings-swatch">
        <input
          type="color" aria-labelledby={labelId} disabled={disabled} value={value[key]}
          onChange={e => set({ ...value, [key]: e.target.value.toLowerCase() })}
        />
      </span>
    ),
  };
}

const PART_NAMES: Record<Parts, string> = { staff: 'Staff', tab: 'Tab', both: 'Both' };

/**
 * A line of text, as the Chat section's key and model. `secret` hides what is typed by drawing it as dots
 * (`.settings-secret`), not as a password field, so password managers don't offer to save it as a login.
 */
function textField<V, K extends keyof V & string>(key: K, label: string, opts: { secret?: boolean; placeholder?: string } = {}): SettingsField<V> {
  return {
    key, label,
    control: ({ value, set, labelId }) => (
      <input
        className={`input settings-text${opts.secret ? ' settings-secret' : ''}`} type="text" aria-labelledby={labelId} value={value[key] as string}
        placeholder={opts.placeholder} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
        data-1p-ignore={opts.secret || undefined} data-lpignore={opts.secret ? 'true' : undefined} data-bwignore={opts.secret || undefined}
        onChange={e => set({ ...value, [key]: e.target.value })}
      />
    ),
  };
}

/**
 * Settings' Tab group, on the page's state. `savePlayback` saves Playback (hiding the controls stops
 * playback).
 */
export function tabSettingsGroup(prefs: TabPrefs, savePlayback: (value: PlaybackSettings) => void): SettingsGroup {
  return {
    id: 'tab',
    name: 'Tab',
    sections: [
      section<PlaybackSettings>({
        id: 'playback', name: 'Playback', value: prefs.playback, defaults: DEFAULT_PLAYBACK, save: savePlayback,
        fields: [
          checkField('shown', 'Show playback controls'),
          knobField('volume', 'Volume'),
          numberField('transpose', 'Transpose', {
            min: -MAX_TRANSPOSE, max: MAX_TRANSPOSE, step: 1, after: 'semitones', upLabel: 'Transpose up', downLabel: 'Transpose down',
          }),
          checkField('hearNotes', 'Hear notes as you enter them'),
          checkField('hearChords', 'Hear chords picked in the Chords panel'),
          { ...checkField<PlaybackSettings, 'strokes'>('strokes', 'Strum the chord'), box: 'Downstroke and Upstroke' },
          { ...rollField('strokesRoll', 'Length', v => v.strokes), box: 'Downstroke and Upstroke' },
          { ...checkField<PlaybackSettings, 'strums'>('strums', 'Strum the chord'), box: 'Strum down and up' },
          { ...rollField('strumsRoll', 'Length', v => v.strums), box: 'Strum down and up' },
          { ...checkField<PlaybackSettings, 'rolledChords'>('rolledChords', 'Roll the chord'), box: 'Rolled chord' },
          { ...rollField('rolledChordsRoll', 'Length', v => v.rolledChords), box: 'Rolled chord' },
          checkField('stopAtPlayhead', 'Stop leaves the cursor where it stopped'),
          checkField('stopAtRegionEnd', 'Stop playback at region end'),
          checkField('loopPause', 'Pause between loops'),
          numberField('loopPauseSeconds', 'Pause length', {
            min: MIN_LOOP_PAUSE, max: MAX_LOOP_PAUSE, step: LOOP_PAUSE_STEP, decimals: 1, unit: 's',
            upLabel: 'Longer pause', downLabel: 'Shorter pause', enabled: v => v.loopPause,
          }),
        ],
      }),
      section<MetronomeSettings>({
        id: 'metronome', name: 'Metronome', value: prefs.metronome, defaults: DEFAULT_METRONOME, save: prefs.setMetronome,
        fields: [
          checkField('on', 'Metronome'),
          checkField('countIn', 'Count in'),
          numberField('countInBars', 'Count-in bars', {
            min: 1, max: MAX_COUNT_IN_BARS, step: 1, upLabel: 'More bars', downLabel: 'Fewer bars', enabled: v => v.countIn,
          }),
          knobField('clickVolume', 'Click volume'),
        ],
      }),
      section<NotationPrefs>({
        id: 'notation', name: 'Notation', value: prefs.notation, defaults: DEFAULT_NOTATION, save: prefs.setNotation,
        fields: [
          choiceField<NotationPrefs, 'show', Parts>('show', 'Show', PARTS.map(p => [p, PART_NAMES[p]] as const)),
          choiceField('barNumbers', 'Bar numbers', BAR_NUMBERS.map(b => [b, BAR_NUMBER_NAMES[b]] as const)),
          numberField('size', 'Size', {
            min: MIN_SIZE, max: MAX_SIZE, step: SIZE_STEP, unit: '%', upLabel: 'Bigger', downLabel: 'Smaller',
            // A typed size goes to the nearest step, as over the clip.
            toValue: n => Math.round(n / SIZE_STEP) * SIZE_STEP,
          }),
          checkField('lineBreaks', "Clip's line breaks"),
          checkField('header', 'Arrangement header'),
          checkField('tuningDetails', 'Tuning details'),
          checkField('chordChart', 'Chord chart'),
          checkField('chordDiagrams', 'Chord diagrams'),
        ],
      }),
      section<ColourPrefs>({
        id: 'colours', name: 'Colours', value: prefs.colours, defaults: DEFAULT_COLOURS, save: prefs.setColours,
        fields: [
          choiceField<ColourPrefs, 'scheme', Colours>('scheme', 'Colours', COLOURS.map(c => [c, COLOUR_NAMES[c]] as const), { write: chooseScheme }),
          colourField('text', 'Text'),
          colourField('background', 'Background'),
        ],
      }),
      section<AsciiPrefs>({
        id: 'ascii', name: 'ASCII Tab', value: prefs.ascii, defaults: DEFAULT_ASCII, save: prefs.setAscii,
        fields: [checkField('rhythm', 'Rhythm'), checkField('chords', 'Chord chart')],
      }),
      section<AlphaTexPrefs>({
        id: 'alphatex', name: 'AlphaTex', value: prefs.alphatex, defaults: DEFAULT_ALPHATEX, save: prefs.setAlphaTex,
        fields: [checkField('lineNumbers', 'Line numbers')],
      }),
      section<EditingPrefs>({
        id: 'editing', name: 'Editing', value: prefs.editing, defaults: DEFAULT_EDITING, save: prefs.setEditing,
        fields: [
          twoWayField('fixedGrid', 'Note input grid', 'Fixed', 'Follow note length'),
          choiceField<EditingPrefs, 'grid', GridValue>('grid', 'Fixed grid', GRID_VALUES.map(g => [g, GRID_NAMES[g]] as const), { enabled: v => v.fixedGrid }),
          choiceField<EditingPrefs, 'gridLook', GridLook>('gridLook', 'Grid drawn as', GRID_LOOKS.map(l => [l, GRID_LOOK_NAMES[l]] as const)),
        ],
      }),
      section<TabExportStyle>({
        id: 'export', name: 'Export', value: prefs.exportStyle, defaults: DEFAULT_TAB_EXPORT, save: prefs.setExportStyle,
        fields: [
          choiceField('width', 'Size (px wide)', TAB_EXPORT_WIDTHS.map(w => [w, String(w)] as const)),
          twoWayField('transparent', 'Transparent background', 'On', 'Off'),
          twoWayField('name', 'Clip name', 'Show', 'Hide'),
        ],
      }),
      section<ChatPrefs>({
        id: 'chat', name: 'Chat', value: prefs.chat, defaults: DEFAULT_CHAT,
        // Saved as read back, so a key pasted with a space round it still works.
        save: value => prefs.setChat(parseChatPrefs(value)),
        fields: [
          textField('apiKey', 'OpenRouter key', { secret: true, placeholder: 'sk-or-…' }),
          textField('model', 'Model', { placeholder: DEFAULT_CHAT.model }),
          instructionsField,
          customField,
        ],
      }),
    ],
  };
}
