'use client';

/**
 * The keyboard shortcuts overlay (issue #180, `docs/specs/2026-10-30-keyboard-shortcuts-design.md`):
 * `?` anywhere but a field shows the page's shortcuts, and `?`, Esc or a click outside hides them.
 * Mounted once by `AppShell`; each page hands its list to `useShortcuts`.
 *
 * Three looks to choose from while the design is open, by `?mock=` in the address: `a` (the
 * default) a dialog with the groups in columns, `b` a sheet down the right side that leaves the
 * page in view, `c` a small dialog showing one group at a time.
 */
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Modal } from '@/components/Modal';
import { CloseIcon } from '@/components/icons';
import { EVERYWHERE, isHelpKey, isMac, keyCaps, type ShortcutGroup } from '@/lib/shortcuts';
import { usePageShortcuts } from './useShortcuts';

type Look = 'a' | 'b' | 'c';

function lookFromAddress(): Look {
  const mock = new URLSearchParams(window.location.search).get('mock');
  return mock === 'b' || mock === 'c' ? mock : 'a';
}

const TITLE = 'Keyboard shortcuts';

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const [look, setLook] = useState<Look>('a');
  const page = usePageShortcuts();
  const groups = [...page, EVERYWHERE];

  // What had the keys before the list opened (say, the tab, whose cursor shows only while it has them) gets them back.
  const before = useRef<HTMLElement | null>(null);
  const close = () => setOpen(false);
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!isHelpKey(e)) return;
    // Another dialog has the page: its keys are its own.
    if (!open && document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (open) {
      close();
      return;
    }
    before.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLook(lookFromAddress());
    setOpen(true);
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // After the dialog has closed (its own effect runs first), or the browser hands the focus to the page.
  useEffect(() => {
    if (open || !before.current) return;
    before.current.focus({ preventScroll: true });
    before.current = null;
  }, [open]);
  if (look === 'b') return <Sheet open={open} onClose={close} groups={groups} />;
  return (
    <Modal open={open} onClose={close} title={TITLE} className={look === 'c' ? 'shortcuts shortcuts-one' : 'shortcuts shortcuts-columns'}>
      {open && (look === 'c' ? <OneGroup groups={groups} /> : <Groups groups={groups} />)}
    </Modal>
  );
}

/** Every group, one after another (in columns where there is room). */
function Groups({ groups }: { groups: ShortcutGroup[] }) {
  const mac = isMac();
  return (
    <div className="shortcuts-body">
      <div className="shortcuts-groups">
        {groups.map(group => <Group key={group.title} group={group} mac={mac} />)}
      </div>
    </div>
  );
}

/** One group at a time, chosen on a segmented control. */
function OneGroup({ groups }: { groups: ShortcutGroup[] }) {
  const [shown, setShown] = useState(groups[0].title);
  const group = groups.find(g => g.title === shown) ?? groups[0];
  return (
    <>
      {groups.length > 1 && (
        <div className="seg shortcuts-seg" role="group" aria-label="Where the keys act">
          {groups.map(g => (
            <button key={g.title} type="button" className="seg-opt" aria-pressed={g === group} onClick={() => setShown(g.title)}>
              {g.title}
            </button>
          ))}
        </div>
      )}
      <div className="shortcuts-body">
        <Group group={group} mac={isMac()} hideTitle />
      </div>
    </>
  );
}

function Group({ group, mac, hideTitle = false }: { group: ShortcutGroup; mac: boolean; hideTitle?: boolean }) {
  return (
    <section className="shortcuts-group" aria-label={group.title}>
      {!hideTitle && <h4 className="shortcuts-group-title">{group.title}</h4>}
      <dl className="shortcuts-list">
        {group.shortcuts.map(s => (
          <div key={s.does} className="shortcuts-row">
            <dt className="shortcuts-keys">
              {s.keys.map((combo, i) => (
                <span key={combo} className="shortcuts-combo">
                  {i > 0 && <span className="shortcuts-or">or</span>}
                  {keyCaps(combo, mac).map((cap, j) => <kbd key={j}>{cap}</kbd>)}
                </span>
              ))}
            </dt>
            <dd className="shortcuts-does">{s.does}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Mock b: a sheet down the right side. Not modal, so the page stays in view and undimmed; Esc,
 * `?` or a press outside it closes it.
 */
function Sheet({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: ShortcutGroup[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.show();
      el.focus();
    } else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    // Caught first, so the page's own Esc (say, the tab's) doesn't act as well.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onEsc, true);
    };
  }, [open]);

  return (
    <dialog ref={ref} className="shortcuts-sheet" aria-labelledby={headingId} tabIndex={-1}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="dialog-title m-0">{TITLE}</h3>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Close keyboard shortcuts" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {open && <Groups groups={groups} />}
    </dialog>
  );
}
