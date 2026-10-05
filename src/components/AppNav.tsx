'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './BrandMark';
import { MenuIcon } from './icons';
import { locate, SECTIONS } from './sections';
import { ThemeSwitch } from './ThemeSwitch';

const MENU_ID = 'site-menu';

/**
 * Wordmark (home), where you are ("Practice › Interval trainer"), the theme
 * button and Menu, which opens a panel listing every page. The location and
 * the menu's current page are read from the URL.
 */
export function AppNav() {
  const pathname = usePathname();
  const { section, page } = locate(pathname);
  // The pathname the menu was opened on: moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const navRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpenOn(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!open || !nav) return;
    panelRef.current?.querySelector('a')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!nav.contains(e.target as Node)) setOpenOn(null);
    };
    // Keys pressed in the open menu stop here, so the trainers' and the
    // Scale lab's window shortcuts don't act on the page behind it.
    const onKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    nav.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      nav.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <nav
      ref={navRef}
      className="relative flex items-center gap-4 border-b border-(--line) px-4 py-3 sm:px-5"
      aria-label="Site"
    >
      <Link href="/" className="flex shrink-0 items-center gap-2.5 text-(--ink) no-underline">
        <BrandMark />
        <span className="font-(family-name:--font-display) text-[22px] leading-7 font-semibold max-sm:sr-only">
          Frets
        </span>
      </Link>
      {section && page && (
        <p className="m-0 min-w-0 truncate text-[14px] font-semibold" data-testid="nav-location">
          <span className="text-(--ink-muted)">{section.label} ›</span> {page.title}
        </p>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeSwitch />
        <button
          ref={buttonRef}
          type="button"
          className="btn btn-secondary max-sm:w-(--control-height) max-sm:px-0"
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label="Menu"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <MenuIcon />
          <span className="max-sm:hidden">Menu</span>
        </button>
      </div>
      <div
        ref={panelRef}
        id={MENU_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 grid gap-4 border-b border-(--line) bg-(--surface-raised) p-4 shadow-[0_12px_24px_-12px_rgb(0_0_0/0.25)] sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] sm:px-5"
      >
        {SECTIONS.map(s => (
          <div key={s.label} className="grid content-start gap-1">
            <h2 id={`menu-${s.label}`} className="m-0 px-2 py-0.5 text-[11px] leading-4 font-bold tracking-[0.08em] text-(--ink-muted) uppercase">
              {s.label}
            </h2>
            <ul aria-labelledby={`menu-${s.label}`} className="m-0 grid list-none gap-0.5 p-0">
              {s.pages.map(p => {
                const current = p === page;
                return (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      aria-current={current ? 'page' : undefined}
                      onClick={close}
                      className="grid gap-0.5 rounded-(--radius-sm) px-2 py-1.5 text-(--ink) no-underline hover:bg-(--surface-sunken) aria-[current=page]:bg-(--primary-soft)"
                    >
                      <span className="flex justify-between gap-3 text-[14px] font-semibold">
                        {p.title}
                        {current && (
                          <span className="text-[12px] font-medium text-(--ink-muted)">You are here</span>
                        )}
                      </span>
                      <span className="text-[13px] leading-5 text-(--ink-muted)">{p.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
