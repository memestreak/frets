'use client';

/**
 * The View options panel (Jeremy, 2026-10-28), under the eye button over the clip: what the view shown
 * shows that is the reader's choice. First the colours, which every view shows, then only the shown
 * view's own under its name (issue #277): Notation (bar numbers, the clip's line breaks), ASCII Tab
 * (the rhythm line) or AlphaTex (line numbers). Notation's Size is not here but over the clip, after
 * Staff | Tab | Both (`SizeField`). A choice applies at once and is remembered, and a press elsewhere
 * or Esc closes the panel.
 */
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import {
  BAR_NUMBER_NAMES, BAR_NUMBERS, COLOUR_NAMES, COLOURS, DEFAULT_COLOURS, DEFAULT_VIEW, MAX_SIZE, MIN_SIZE, SCHEMES, SIZE_STEP,
  type ColourPair, type ColourPrefs, type Colours, type TabView,
} from './viewOptions';
import { usePopover } from './usePopover';
import { VIEWS, type View } from './views';

export function ViewOptions({ x, y, view, values, onChange, onClose }: {
  /** Under its button: the panel's right edge at x, its top at y, in viewport pixels. */
  x: number;
  y: number;
  /** The view shown: only its own options are listed, after the colours. */
  view: View;
  values: TabView;
  onChange: (values: TabView) => void;
  onClose: (pressedAway: boolean) => void;
}) {
  const { ref, style } = usePopover({ x, y, align: 'end', onClose });
  return (
    <div
      ref={ref} role="dialog" aria-label="View options" className="shape-menu tab-view-options" style={style} tabIndex={-1}
    >
      <h3 className="tab-view-heading">Colours</h3>
      <div className="seg tab-view-colours" role="group" aria-label="Colours">
        {COLOURS.map(c => (
          <button
            key={c} type="button" className="seg-opt" aria-pressed={values.colours === c}
            onClick={() => onChange(choose(values, c))}
          >
            {COLOUR_NAMES[c]}
          </button>
        ))}
      </div>
      {/* Custom shows its two colours, each opening the colour picker. */}
      {values.colours === 'custom' && (
        <div className="tab-view-swatches">
          <Swatch label="Text" value={values.custom.text} onChange={text => onChange({ ...values, custom: { ...values.custom, text } })} />
          <Swatch label="Background" value={values.custom.background} onChange={background => onChange({ ...values, custom: { ...values.custom, background } })} />
        </div>
      )}
      <h3 className="tab-view-heading">{VIEWS.find(v => v.id === view)!.label}</h3>
      {view === 'tab' && (
        <>
          <div className="tab-view-option">
            <span id="bar-numbers-label">Bar numbers</span>
            <div className="seg" role="group" aria-labelledby="bar-numbers-label">
              {BAR_NUMBERS.map(b => (
                <button
                  key={b} type="button" className="seg-opt" aria-pressed={values.barNumbers === b}
                  onClick={() => onChange({ ...values, barNumbers: b })}
                >
                  {BAR_NUMBER_NAMES[b]}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Clip's line breaks" on={values.lineBreaks} onChange={lineBreaks => onChange({ ...values, lineBreaks })} />
        </>
      )}
      {view === 'ascii' && <Toggle label="Rhythm" on={values.asciiRhythm} onChange={asciiRhythm => onChange({ ...values, asciiRhythm })} />}
      {view === 'alphatex' && <Toggle label="Line numbers" on={values.lineNumbers} onChange={lineNumbers => onChange({ ...values, lineNumbers })} />}
    </div>
  );
}

/**
 * The Notation view's Size, over the clip after Staff | Tab | Both (issue #277): 50% to 200% in steps
 * of 10. A typed size goes to the nearest step, and a double-click on it puts it back to 100%, as
 * Speed's does.
 */
export function SizeField({ size, onChange }: { size: number; onChange: (size: number) => void }) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type 100
    <div className="tab-speed tab-size" role="group" aria-label="Size" onDoubleClick={e => resetOnDoubleClick(e, () => onChange(DEFAULT_VIEW.size))}>
      <span aria-hidden="true">Size</span>
      <NumberField
        value={size} min={MIN_SIZE} max={MAX_SIZE} step={SIZE_STEP} decimals={0} unit="%"
        label="Size (percent)" upLabel="Bigger" downLabel="Smaller"
        onChange={typed => onChange(Math.round(typed / SIZE_STEP) * SIZE_STEP)}
      />
    </div>
  );
}

/**
 * A scheme picked. Custom starts from the colours shown when it is first picked, a named scheme's or
 * the theme's, and afterwards keeps its own. Settings › Colours picks through this too.
 */
export function chooseScheme(prefs: ColourPrefs, scheme: Colours): ColourPrefs {
  const isDefaultCustom = prefs.text === DEFAULT_COLOURS.text && prefs.background === DEFAULT_COLOURS.background;
  if (scheme !== 'custom' || prefs.scheme === 'custom' || !isDefaultCustom) return { ...prefs, scheme };
  const from = prefs.scheme === 'theme' ? themeColours() : SCHEMES[prefs.scheme];
  return { ...prefs, scheme, ...(from ?? {}) };
}

/** The View options' pick, on the view the panel shows. */
function choose(values: TabView, colours: Colours): TabView {
  const picked = chooseScheme({ scheme: values.colours, ...values.custom }, colours);
  return { ...values, colours: picked.scheme, custom: { text: picked.text, background: picked.background } };
}

/** The theme's ink and card colours as the page draws them now, light or dark. */
function themeColours(): ColourPair | null {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--ink').trim().toLowerCase();
  const background = css.getPropertyValue('--surface-raised').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(text) && /^#[0-9a-f]{6}$/.test(background) ? { text, background } : null;
}

/** A colour and its name: a press on the swatch opens the browser's colour picker. */
function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="tab-view-swatch">
      <input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value.toLowerCase())} />
      {label}
    </label>
  );
}

/** An option that is on or off: a check box and its name, the whole row pressable. */
export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="tab-view-toggle" onClick={() => onChange(!on)}>
      <span className="tab-view-box" aria-hidden="true">
        {on && <svg width={12} height={12} viewBox="0 0 12 12"><path d="m2 6.5 2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {label}
    </button>
  );
}
