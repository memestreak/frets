'use client';

/**
 * The Chat panel's Model field: type any OpenRouter model, or pick from a list of the viewer's presets
 * and the models that take tools. A datalist would hide every entry not containing what the field
 * already holds, so a saved model hid the presets; this list shows everything until the viewer types.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Preset } from './openRouter';

interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  presets: readonly Preset[];
  models: readonly string[];
  disabled?: boolean;
}

interface Choice {
  model: string;
  description: string;
  group: 'Your presets' | 'Models';
}

export function ModelPicker({ value, onChange, presets, models, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  /** What the viewer typed since opening the list, or null to show every choice. */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const all: Choice[] = [
    ...presets.map(p => ({ model: p.model, description: p.description, group: 'Your presets' as const })),
    ...models.map(m => ({ model: m, description: '', group: 'Models' as const })),
  ];
  const needle = query?.trim().toLowerCase() ?? '';
  const shown = needle ? all.filter(c => `${c.model} ${c.description}`.toLowerCase().includes(needle)) : all;

  const show = () => {
    setQuery(null);
    setActive(-1);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const pick = (choice: Choice) => {
    onChange(choice.model);
    close();
    // Let go of the field once a model is picked.
    inputRef.current?.blur();
  };
  /** Moves the highlight and keeps it in view by scrolling the list only, never the page. */
  const moveTo = (index: number) => {
    setActive(index);
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // The page's own keys stay out of the field.
    e.stopPropagation();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); return; }
      if (shown.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      moveTo(active < 0 ? (step > 0 ? 0 : shown.length - 1) : (active + step + shown.length) % shown.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && shown[active]) pick(shown[active]);
      else { close(); inputRef.current?.blur(); }
    } else if (e.key === 'Escape') {
      if (open) close();
      else inputRef.current?.blur();
    }
  };

  return (
    <div className="tab-chat-picker">
      <input
        ref={inputRef} className="input" role="combobox" aria-label="Model" aria-expanded={open} aria-controls={listId}
        aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        value={value} spellCheck={false} disabled={disabled}
        onFocus={show} onBlur={close} onClick={() => { if (!open) show(); }}
        onChange={e => { onChange(e.target.value); setQuery(e.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button" className="tab-chat-picker-toggle" aria-label="Show models" tabIndex={-1} disabled={disabled}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { if (open) close(); else { inputRef.current?.focus({ preventScroll: true }); show(); } }}
      >
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && shown.length > 0 && (
        // A press in the list keeps the field focused (the field's blur closes the list), and picks the option pressed.
        <div
          ref={listRef} id={listId} role="listbox" aria-label="Models" tabIndex={-1} className="tab-chat-picker-list"
          onMouseDown={e => e.preventDefault()}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') close(); }}
          onClick={e => {
            const index = Number((e.target as HTMLElement).closest<HTMLElement>('[data-index]')?.dataset.index);
            if (shown[index]) pick(shown[index]);
          }}
        >
          {shown.map((choice, i) => (
            <div key={`${choice.group}:${choice.model}`} role="presentation">
              {(i === 0 || shown[i - 1].group !== choice.group) && <div className="tab-chat-picker-group" aria-hidden="true">{choice.group}</div>}
              <div
                id={`${listId}-${i}`} role="option" aria-selected={i === active} tabIndex={-1} data-index={i} className="tab-chat-picker-option"
                onMouseMove={() => { if (i !== active) setActive(i); }}
              >
                <span className="tab-chat-picker-model">{choice.model}</span>
                {choice.description && <span className="tab-chat-picker-description">{choice.description}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
