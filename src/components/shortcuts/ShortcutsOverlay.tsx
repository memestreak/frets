'use client';

/**
 * The keyboard shortcuts overlay (issue #180, `docs/specs/2026-10-30-keyboard-shortcuts-design.md`):
 * `?` anywhere but a field (or a page's ? button, `showShortcuts`) shows the page's shortcuts in a
 * dialog, the groups in columns where there is room, each titled on a sunken band; `?`, Esc, the ×
 * or a click outside hides them. Mounted once by `AppShell`; each page hands its list to
 * `useShortcuts`.
 */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Modal } from '@/components/Modal';
import { EVERYWHERE, isHelpKey, isMac, keyCaps, type ShortcutGroup } from '@/lib/shortcuts';
import { onShowShortcuts, usePageShortcuts } from './useShortcuts';

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const page = usePageShortcuts();
  const groups = [...page, EVERYWHERE];

  // What had the keys before the list opened (say, the tab, whose cursor shows only while it has them) gets them back.
  const before = useRef<HTMLElement | null>(null);
  const close = () => setOpen(false);
  // Opened by a page's ? button: nothing keeps the keys after, so the button shows no focus ring.
  const fromButton = useRef(false);
  const show = (byButton = false) => {
    fromButton.current = byButton;
    before.current = byButton || !(document.activeElement instanceof HTMLElement) ? null : document.activeElement;
    setOpen(true);
  };
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!isHelpKey(e)) return;
    // Another dialog has the page: its keys are its own.
    if (!open && document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (open) close();
    else show();
  });
  const onShow = useEffectEvent(() => show(true));
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    const stopShowing = onShowShortcuts(() => onShow());
    return () => {
      window.removeEventListener('keydown', listener);
      stopShowing();
    };
  }, []);

  // After the dialog has closed (its own effect runs first), or the browser hands the focus to the page.
  useEffect(() => {
    if (open) return;
    if (fromButton.current) {
      fromButton.current = false;
      // The browser hands the focus back to the button the dialog was opened from.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    before.current?.focus({ preventScroll: true });
    before.current = null;
  }, [open]);

  const mac = isMac();
  return (
    <Modal open={open} onClose={close} title="Keyboard shortcuts" className="shortcuts">
      {open && (
        <div className="shortcuts-body">
          <div className="shortcuts-groups">
            {groups.map(group => <Group key={group.title} group={group} mac={mac} />)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Group({ group, mac }: { group: ShortcutGroup; mac: boolean }) {
  return (
    <section className="shortcuts-group" aria-label={group.title}>
      <h4 className="shortcuts-group-title">{group.title}</h4>
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
