'use client';

/**
 * The Settings dialog (issue #195; `docs/specs/2026-10-29-settings-design.md`): every per-viewer
 * preference in one place, shaped like REAPER's Preferences. A tree of groups and their sections on
 * the left (on a phone, a group picker and a strip of its sections), the selected section's fields
 * on the right, and OK, Cancel and Apply at the foot.
 *
 * Changes are staged: OK saves them and closes, Apply saves them and stays, Cancel (×, Esc) drops
 * them. Saving hands each changed section to its page's own setter, so the page updates at once and
 * its in-page controls show the same values. A double-click (or a long-press) on a field's label
 * stages its default. Enter is OK from anywhere but a button, and a number being typed takes the
 * first Enter itself.
 */
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronDownIcon, ChevronRightIcon, CloseIcon } from '@/components/icons';
import type { AnySection, SettingsGroup, SettingsPlace } from './types';

/** How long a press on a label must be held to reset it, on a touch screen. */
const LONG_PRESS_MS = 500;

/** A section's place in the dialog: its group's id and its own. */
const keyOf = (group: string, section: string) => `${group}.${section}`;

/** Two saved values alike: they are plain JSON, written in the same field order by their parsers. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function SettingsDialog({ groups, open, at, onClose }: {
  /** General first, then each page's group. */
  groups: SettingsGroup[];
  open: boolean;
  /** Where it opens: this group expanded (the others collapsed) at this section. */
  at: SettingsPlace;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const sections = groups.flatMap(g => g.sections.map(s => ({ group: g, section: s, key: keyOf(g.id, s.id) })));
  const savedValues = () => Object.fromEntries(sections.map(s => [s.key, s.section.value]));

  const [staged, setStaged] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState(keyOf(at.group, at.section));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([at.group]));
  // Each opening starts from what is saved, at the place it was opened for.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStaged(savedValues());
      setSelected(keyOf(at.group, at.section));
      setExpanded(new Set([at.group]));
    }
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // The keys start in the tree, on the section shown.
      el.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]')?.focus();
    } else if (!open && el.open) el.close();
  }, [open]);

  const stagedOf = (s: (typeof sections)[number]) => (s.key in staged ? staged[s.key] : s.section.value) as Record<string, unknown>;
  const changed = sections.filter(s => !same(stagedOf(s), s.section.value));
  const apply = () => changed.forEach(s => s.section.save(stagedOf(s)));
  const ok = () => {
    apply();
    onClose();
  };

  const current = sections.find(s => s.key === selected) ?? sections[0];
  const stage = (key: string, value: unknown) => setStaged(st => ({ ...st, [key]: value }));

  // Enter is OK, as in REAPER (G2): from anywhere but a button, which Enter presses, and a number
  // field being typed in, which takes the first Enter itself (it prevents the default). Heard on the
  // document, so the fields' own handlers have had it first.
  const onEnter = useEffectEvent((e: globalThis.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
    const target = e.target as HTMLElement;
    if (!ref.current?.contains(target) || target.closest('button, a, textarea, input[type="color"]')) return;
    e.preventDefault();
    ok();
  });
  useEffect(() => {
    if (!open) return;
    const listener = (e: globalThis.KeyboardEvent) => onEnter(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [open]);

  return (
    <dialog
      ref={ref} className="settings-dialog settings-prefs" aria-labelledby={headingId}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      {open && current && (
        <div className="settings-dialog-inner">
          <div className="flex items-center justify-between gap-3">
            <h3 id={headingId} className="dialog-title m-0">Settings</h3>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Close settings" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <div className="settings-prefs-body">
            <SettingsTree
              groups={groups} selected={selected} expanded={expanded}
              onSelect={setSelected}
              onExpand={(group, on) => setExpanded(ex => {
                const next = new Set(ex);
                if (on) next.add(group);
                else next.delete(group);
                return next;
              })}
            />
            <PhoneNav groups={groups} selected={current} onSelect={setSelected} />
            <SectionPane
              key={current.key} group={current.group} section={current.section}
              value={stagedOf(current)} onStage={value => stage(current.key, value)}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn btn-primary" onClick={ok}>OK</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-secondary" disabled={changed.length === 0} onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * The tree (G6, the standard tree pattern): each group's head opens and closes it, its sections are
 * under it, and the selected one is filled. ↑ ↓ move between what is shown, and the pane follows the
 * section reached; → opens a group (or goes into it), ← closes it (or goes from a section to its group).
 */
function SettingsTree({ groups, selected, expanded, onSelect, onExpand }: {
  groups: SettingsGroup[];
  selected: string;
  expanded: Set<string>;
  onSelect: (key: string) => void;
  onExpand: (group: string, on: boolean) => void;
}) {
  // The item the keys are on: a group's id, or a section's key. Starts on the selected section.
  const [focus, setFocus] = useState(selected);
  const tree = useRef<HTMLDivElement>(null);
  const shown = groups.flatMap(g => [
    { key: g.id, group: g.id, isGroup: true },
    ...(expanded.has(g.id) ? g.sections.map(s => ({ key: keyOf(g.id, s.id), group: g.id, isGroup: false })) : []),
  ]);
  // The roving tab stop: the item the keys are on, else the selected section, else the first group.
  const stop = shown.some(i => i.key === focus) ? focus : shown.some(i => i.key === selected) ? selected : shown[0]?.key;

  const goTo = (key: string) => {
    setFocus(key);
    if (shown.find(i => i.key === key)?.isGroup === false) onSelect(key);
    // Focus moves once the item is drawn with its tab stop.
    requestAnimationFrame(() => tree.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = shown.findIndex(i => i.key === stop);
    const item = shown[at];
    if (!item) return;
    const move = (to: number) => {
      const next = shown[Math.max(0, Math.min(shown.length - 1, to))];
      if (next) goTo(next.key);
    };
    switch (e.key) {
      case 'ArrowDown': move(at + 1); break;
      case 'ArrowUp': move(at - 1); break;
      case 'Home': move(0); break;
      case 'End': move(shown.length - 1); break;
      case 'ArrowRight':
        if (!item.isGroup) return;
        if (!expanded.has(item.key)) onExpand(item.key, true);
        else if (shown[at + 1] && !shown[at + 1].isGroup) goTo(shown[at + 1].key);
        break;
      case 'ArrowLeft':
        if (item.isGroup) onExpand(item.key, false);
        else goTo(item.group);
        break;
      case ' ':
        if (item.isGroup) onExpand(item.key, !expanded.has(item.key));
        else onSelect(item.key);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    // The items take the presses; the keys are handled here, for whichever item has the focus.
    <div ref={tree} role="tree" tabIndex={-1} aria-label="Settings sections" className="settings-tree" onKeyDown={onKeyDown}>
      {groups.map(g => {
        const open = expanded.has(g.id);
        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the tree handles the keys
          <div
            key={g.id} role="treeitem" aria-expanded={open} aria-selected={false} data-key={g.id}
            tabIndex={stop === g.id ? 0 : -1} className="settings-tree-group"
            onFocus={e => {
              if (e.target === e.currentTarget) setFocus(g.id);
            }}
            onClick={e => {
              // A press on one of its sections is that section's.
              if ((e.target as Element).closest('[role="group"]')) return;
              setFocus(g.id);
              onExpand(g.id, !open);
            }}
          >
            <span className="settings-tree-head">
              {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
              {g.name}
            </span>
            {open && (
              <div role="group">
                {g.sections.map(s => {
                  const key = keyOf(g.id, s.id);
                  return (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the tree handles the keys
                    <div
                      key={s.id} role="treeitem" aria-selected={selected === key} data-key={key}
                      tabIndex={stop === key ? 0 : -1} className="settings-tree-item"
                      onFocus={e => {
                        e.stopPropagation();
                        setFocus(key);
                      }}
                      onClick={() => {
                        setFocus(key);
                        onSelect(key);
                      }}
                    >
                      {s.name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * On a phone-width screen, in the tree's place: a group picker, and under it a strip of that group's
 * sections that scrolls sideways. CSS shows one or the other.
 */
function PhoneNav({ groups, selected, onSelect }: {
  groups: SettingsGroup[];
  selected: { group: SettingsGroup; section: AnySection };
  onSelect: (key: string) => void;
}) {
  const group = selected.group;
  return (
    <div className="settings-phone-nav">
      <select
        className="input" aria-label="Settings group" value={group.id}
        onChange={e => {
          const next = groups.find(g => g.id === e.target.value);
          if (next?.sections[0]) onSelect(keyOf(next.id, next.sections[0].id));
        }}
      >
        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <div className="settings-phone-strip" role="group" aria-label={`${group.name} sections`}>
        {group.sections.map(s => (
          <button
            key={s.id} type="button" className="settings-tree-item" aria-pressed={s.id === selected.section.id}
            onClick={() => onSelect(keyOf(group.id, s.id))}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The selected section, framed and headed `Group › Section`: a row per field, its label then its control. */
function SectionPane({ group, section, value, onStage }: {
  group: SettingsGroup;
  section: AnySection;
  value: Record<string, unknown>;
  onStage: (value: Record<string, unknown>) => void;
}) {
  const id = useId();
  return (
    <section className="settings-pane" aria-labelledby={`${id}-heading`}>
      <h4 id={`${id}-heading`} className="settings-pane-heading">{group.name} › {section.name}</h4>
      <div className="settings-rows">
        {section.fields.map(f => {
          const labelId = `${id}-${f.key}`;
          const disabled = f.enabled ? !f.enabled(value) : false;
          return (
            <div key={f.key} className="settings-row" data-disabled={disabled || undefined}>
              <ResetLabel id={labelId} onReset={() => onStage({ ...value, [f.key]: section.defaults[f.key] })}>
                {f.label}
              </ResetLabel>
              <div className="settings-control">
                {f.control({ value, set: onStage, labelId, disabled })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * A field's label: a double-click on it, or a long-press on a touch screen, stages the field's
 * default. The control itself never resets, so a number's text can still be selected.
 */
function ResetLabel({ id, onReset, children }: { id: string; onReset: () => void; children: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      onReset();
    }, LONG_PRESS_MS);
  };
  return (
    // A mouse and touch shortcut; from the keyboard, the control sets the value itself.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      id={id} className="settings-label" title="Double-click to reset"
      onDoubleClick={e => {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        onReset();
      }}
      onPointerDown={onPointerDown} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      // A long-press would open the phone's own menu for the text.
      onContextMenu={e => e.preventDefault()}
    >
      {children}
    </span>
  );
}
