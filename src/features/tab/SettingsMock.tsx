'use client';

/**
 * MOCK ONLY (issue #195): three looks for the Settings dialog, picked with `/tab?mock=a|b|c`. Each one
 * reads the saved values, stages changes, enables Apply once something differs from what is saved and
 * resets a value on a double-click; none of them saves anything yet (OK, Apply and Cancel just close or
 * clear). Deleted once Jeremy picks one.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Segmented } from '@/components/controls';
import { ChevronDownIcon, ChevronRightIcon, CloseIcon, SearchIcon } from '@/components/icons';
import { loadJson } from '@/lib/storage';
import { currentTheme, type ThemeChoice } from '@/lib/theme';
import { NumberField } from './NumberField';
import { VolumeKnob } from './VolumeKnob';
import { Toggle } from './ViewOptions';
import { BAR_NUMBER_NAMES, BAR_NUMBERS, COLOUR_NAMES, COLOURS, MAX_SIZE, MIN_SIZE, parseView, SIZE_STEP, VIEW_KEY } from './viewOptions';
import { parsePlaybackSettings, PLAYBACK_KEY, MAX_TRANSPOSE } from './PlaybackFooter';
import { parseTabExportStyle, TAB_EXPORT_KEY, TAB_EXPORT_WIDTHS } from './exportTab';
import { parseParts, PARTS_KEY } from './layout';
import { MAX_COUNT_IN_BARS } from './playback';
import { MAX_LOOP_PAUSE, MIN_LOOP_PAUSE } from './PlaybackOptions';

export type MockKind = 'a' | 'b' | 'c';

type Link = 'full' | 'isgd' | 'frets';

interface Values {
  theme: ThemeChoice;
  colours: string; parts: string; barNumbers: string; size: number; lineBreaks: boolean;
  asciiRhythm: boolean; lineNumbers: boolean;
  shown: boolean; volume: number; hearNotes: boolean; transpose: number; metronome: boolean; countIn: boolean;
  countInBars: number; clickVolume: number; stopAtPlayhead: boolean; stopAtRegionEnd: boolean; loopPause: boolean;
  loopPauseSeconds: number;
  width: number; transparent: boolean; name: boolean;
  link: Link;
}

function valuesFrom(view: unknown, playback: unknown, exp: unknown, parts: unknown, theme: ThemeChoice): Values {
  const v = parseView(view);
  const p = parsePlaybackSettings(playback);
  const e = parseTabExportStyle(exp);
  return {
    theme, colours: v.colours, parts: parseParts(parts), barNumbers: v.barNumbers, size: v.size, lineBreaks: v.lineBreaks,
    asciiRhythm: v.asciiRhythm, lineNumbers: v.lineNumbers,
    shown: p.shown, volume: p.volume, hearNotes: p.hearNotes, transpose: p.transpose, metronome: p.metronome, countIn: p.countIn,
    countInBars: p.countInBars, clickVolume: p.clickVolume, stopAtPlayhead: p.stopAtPlayhead, stopAtRegionEnd: p.stopAtRegionEnd,
    loopPause: p.loopPause, loopPauseSeconds: p.loopPauseSeconds,
    width: e.width, transparent: e.transparent, name: e.name,
    link: 'full',
  };
}

const DEFAULTS = valuesFrom(undefined, undefined, undefined, undefined, 'auto');

type Setter = <K extends keyof Values>(key: K, value: Values[K]) => void;

interface Field {
  key: keyof Values;
  label: string;
  control: (v: Values, set: Setter) => ReactNode;
}

interface Section { id: string; group: 'General' | 'Tab'; name: string; fields: Field[] }

const seg = <K extends keyof Values>(key: K, label: string, options: readonly (readonly [string, string])[]): Field => ({
  key, label,
  control: (v, set) => <Segmented label={label} value={String(v[key])} options={options} onChange={x => set(key, x as Values[K])} />,
});
const toggle = (key: keyof Values, label: string): Field => ({
  key, label,
  control: (v, set) => <Toggle label={label} on={v[key] as boolean} onChange={on => set(key, on as never)} />,
});
const knob = (key: 'volume' | 'clickVolume', label: string): Field => ({
  key, label,
  control: (v, set) => <span className="mock-knob"><VolumeKnob value={v[key]} onChange={x => set(key, x)} labelledBy={`mock-${key}`} name={label} /></span>,
});

const SECTIONS: Section[] = [
  { id: 'theme', group: 'General', name: 'Theme', fields: [seg('theme', 'Theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])] },
  { id: 'colours', group: 'Tab', name: 'Colours', fields: [seg('colours', 'Colours', COLOURS.map(c => [c, COLOUR_NAMES[c]] as const))] },
  {
    id: 'notation', group: 'Tab', name: 'Notation', fields: [
      seg('parts', 'Show', [['staff', 'Staff'], ['tab', 'Tab'], ['both', 'Both']]),
      seg('barNumbers', 'Bar numbers', BAR_NUMBERS.map(b => [b, BAR_NUMBER_NAMES[b]] as const)),
      {
        key: 'size', label: 'Size',
        control: (v, set) => <NumberField value={v.size} min={MIN_SIZE} max={MAX_SIZE} step={SIZE_STEP} unit="%" label="Size (percent)" upLabel="Bigger" downLabel="Smaller" onChange={x => set('size', x)} />,
      },
      toggle('lineBreaks', "Clip's line breaks"),
    ],
  },
  { id: 'ascii', group: 'Tab', name: 'ASCII Tab', fields: [toggle('asciiRhythm', 'Rhythm')] },
  { id: 'alphatex', group: 'Tab', name: 'AlphaTex', fields: [toggle('lineNumbers', 'Line numbers')] },
  {
    id: 'playback', group: 'Tab', name: 'Playback', fields: [
      toggle('shown', 'Show playback controls'),
      knob('volume', 'Volume'),
      {
        key: 'transpose', label: 'Transpose',
        control: (v, set) => <NumberField value={v.transpose} min={-MAX_TRANSPOSE} max={MAX_TRANSPOSE} step={1} label="Transpose (semitones)" upLabel="Up" downLabel="Down" onChange={x => set('transpose', x)} />,
      },
      toggle('hearNotes', 'Hear notes as you enter them'),
      toggle('metronome', 'Metronome'),
      toggle('countIn', 'Count in'),
      {
        key: 'countInBars', label: 'Count-in bars',
        control: (v, set) => <NumberField value={v.countInBars} min={1} max={MAX_COUNT_IN_BARS} step={1} label="Count-in bars" upLabel="More" downLabel="Fewer" onChange={x => set('countInBars', x)} />,
      },
      knob('clickVolume', 'Click volume'),
      toggle('stopAtPlayhead', 'Stop leaves the cursor where it stopped'),
      toggle('stopAtRegionEnd', 'Stop playback at region end'),
      toggle('loopPause', 'Pause between loops'),
      {
        key: 'loopPauseSeconds', label: 'Pause length',
        control: (v, set) => <NumberField value={v.loopPauseSeconds} min={MIN_LOOP_PAUSE} max={MAX_LOOP_PAUSE} step={0.5} decimals={1} unit="s" label="Pause between loops (seconds)" upLabel="Longer" downLabel="Shorter" onChange={x => set('loopPauseSeconds', x)} />,
      },
    ],
  },
  {
    id: 'export', group: 'Tab', name: 'Export', fields: [
      seg('width', 'Size (px wide)', TAB_EXPORT_WIDTHS.map(w => [String(w), String(w)] as const)),
      toggle('transparent', 'Transparent'),
      toggle('name', 'Clip name'),
    ],
  },
  { id: 'sharing', group: 'Tab', name: 'Sharing', fields: [seg('link', 'Copy link makes', [['full', 'Full link'], ['isgd', 'is.gd'], ['frets', 'Frets short link']])] },
];

// Segmented compares strings; the export width is a number.
const asStored = (key: keyof Values, value: unknown) => (key === 'width' ? Number(value) : value);

/** Toggles carry their own label, so their row shows no second one. */
const selfLabelled = (f: Field) => ['lineBreaks', 'asciiRhythm', 'lineNumbers', 'shown', 'hearNotes', 'metronome', 'countIn', 'stopAtPlayhead', 'stopAtRegionEnd', 'loopPause', 'transparent', 'name'].includes(f.key);

export function SettingsMock({ kind, open, onClose }: { kind: MockKind; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState<Values>(DEFAULTS);
  const [staged, setStaged] = useState<Values>(DEFAULTS);
  const [section, setSection] = useState('notation');
  const [openGroups, setOpenGroups] = useState({ General: false, Tab: true });
  const [find, setFind] = useState('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      const now = valuesFrom(loadJson(VIEW_KEY), loadJson(PLAYBACK_KEY), loadJson(TAB_EXPORT_KEY), loadJson(PARTS_KEY), currentTheme());
      setSaved(now);
      setStaged(now);
      el.showModal();
    } else if (!open && el.open) el.close();
  }, [open]);

  const set: Setter = (key, value) => setStaged(s => ({ ...s, [key]: asStored(key, value) }));
  const changed = useMemo(() => (Object.keys(saved) as (keyof Values)[]).some(k => saved[k] !== staged[k]), [saved, staged]);
  const reset = (key: keyof Values) => setStaged(s => ({ ...s, [key]: DEFAULTS[key] }));

  const q = find.trim().toLowerCase();
  const matches = (s: Section) => !q || s.name.toLowerCase().includes(q) || s.fields.some(f => f.label.toLowerCase().includes(q));
  const shown = SECTIONS.filter(matches);

  const row = (f: Field, s: Section) => (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mock: double-click resets
    <div
      key={f.key} className={`mock-row${kind === 'c' ? ' mock-row-c' : ''}`}
      onDoubleClick={e => { if (!(e.target as Element).closest('.tab-number-steps')) reset(f.key); }}
    >
      {!selfLabelled(f) && f.label !== s.name && <span className="mock-label" id={`mock-${f.key}`}>{f.label}</span>}
      <span className="mock-control">{f.control(staged, set)}</span>
      {kind === 'c' && staged[f.key] !== DEFAULTS[f.key] && <span className="mock-dot" title="Not the default: double-click to reset" />}
    </div>
  );

  const pane = (s: Section) => (
    <section key={s.id} id={`mock-section-${s.id}`} className="mock-section">
      <h4 className="mock-section-title">{kind === 'b' ? s.name : `${s.group} › ${s.name}`}</h4>
      <div className={kind === 'c' ? 'mock-rows-c' : 'mock-rows'}>{s.fields.filter(f => !q || matches({ ...s, fields: [f] }) || s.name.toLowerCase().includes(q)).map(f => row(f, s))}</div>
    </section>
  );

  const go = (id: string) => {
    setSection(id);
    if (kind === 'b') document.getElementById(`mock-section-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const nav = (
    <nav className={`mock-nav mock-nav-${kind}`} aria-label="Settings sections">
      {(['General', 'Tab'] as const).map(group => {
        const items = shown.filter(s => s.group === group);
        if (!items.length) return null;
        const expanded = kind !== 'a' || openGroups[group] || !!q;
        return (
          <div key={group} className="mock-group">
            {kind === 'a' ? (
              <button type="button" className="mock-group-head" aria-expanded={expanded} onClick={() => setOpenGroups(g => ({ ...g, [group]: !g[group] }))}>
                {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />} {group}
              </button>
            ) : (
              <div className="mock-group-label">{group}</div>
            )}
            {expanded && items.map(s => (
              <button key={s.id} type="button" className="mock-nav-item" aria-current={section === s.id ? 'true' : undefined} onClick={() => go(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );

  const current = shown.find(s => s.id === section) ?? shown[0];
  const close = () => onClose();

  return (
    <dialog
      ref={ref} className={`settings-dialog mock-settings mock-settings-${kind}`} aria-label="Settings"
      onCancel={e => { e.preventDefault(); close(); }}
    >
      {open && (
        <div className="settings-dialog-inner">
          <div className="flex items-center justify-between gap-3">
            <h3 className="dialog-title m-0">Settings</h3>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Close settings" onClick={close}><CloseIcon /></button>
          </div>
          <div className="mock-body">
            <div className="mock-side">
              {nav}
              {kind !== 'b' && (
                <label className="mock-find">
                  <SearchIcon />
                  <input className="input" type="search" placeholder="Find" value={find} onChange={e => setFind(e.target.value)} aria-label="Find a setting" />
                </label>
              )}
            </div>
            <div className="mock-pane">
              {kind === 'b'
                ? (['General', 'Tab'] as const).map(g => {
                  const ss = shown.filter(s => s.group === g);
                  return ss.length ? <div key={g}><div className="mock-pane-group">{g}</div>{ss.map(pane)}</div> : null;
                })
                : current && pane(current)}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-(--ink-muted) mock-hint">Mock {kind.toUpperCase()}: nothing is saved</span>
            <button type="button" className="btn btn-primary" onClick={close}>OK</button>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-secondary" disabled={!changed} onClick={() => setSaved(staged)}>Apply</button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** The page-top gear. */
export function GearIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
