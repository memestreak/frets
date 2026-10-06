'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './BrandMark';
import { ChevronDownIcon } from './icons';
import { locate, SECTIONS } from './sections';
import { ThemeSwitch } from './ThemeSwitch';

const MENU_ID = 'site-menu';

/** "›" between crumbs; decoration only. */
function Separator() {
  return <span aria-hidden="true" className="font-normal text-(--line-strong)">›</span>;
}

/**
 * The bar: the logo (home), the path to the current page as breadcrumbs
 * ("Explore › Scale lab") and the theme switch. The breadcrumbs are one
 * button that opens a panel listing every section and page, with the
 * current ones marked. Everything is read from the URL.
 */
export function AppNav() {
  const pathname = usePathname();
  const { section, page } = locate(pathname);
  // The pathname the menu was opened on: moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const barRef = useRef<HTMLElement>(null);
  const crumbsRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpenOn(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!open || !bar) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[aria-current=page]') ?? panel?.querySelector('a'))?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!bar.contains(e.target as Node)) setOpenOn(null);
    };
    // Keys pressed in the open menu stop here, so the trainers' and the
    // Scale lab's window shortcuts don't act on the page behind it.
    const onKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        setOpenOn(null);
        crumbsRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    bar.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      bar.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <nav
      ref={barRef}
      aria-label="Site"
      className="relative flex items-center gap-3 border-b border-(--line) px-4 py-3 sm:px-5"
    >
      <Link
        href="/"
        aria-current={section ? undefined : 'page'}
        className="flex shrink-0 items-center gap-2.5 text-(--ink) no-underline"
      >
        <BrandMark />
        {/* Narrow screens keep the room for the breadcrumbs. */}
        <span className={`${section ? 'sr-only sm:not-sr-only' : ''} font-(family-name:--font-display) text-[22px] leading-7 font-semibold`}>
          Frets
        </span>
      </Link>
      {section && (
        <button
          ref={crumbsRef}
          type="button"
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={`${[section.label, page?.title].filter(Boolean).join(' › ')}: show every page`}
          onClick={() => setOpenOn(open ? null : pathname)}
          className="flex min-w-0 cursor-pointer items-center gap-2 rounded-(--radius-sm) border-0 bg-transparent px-2 py-1 font-(family-name:--font-sans) text-[14px] font-semibold hover:bg-(--surface-sunken) aria-expanded:bg-(--surface-sunken)"
        >
          <Separator />
          <span className={`whitespace-nowrap ${page ? 'text-(--ink-muted)' : 'text-(--ink)'}`}>
            {section.label}
          </span>
          {page && (
            <>
              <Separator />
              <span className="truncate text-(--ink)">{page.title}</span>
            </>
          )}
          <span className="shrink-0 text-(--ink-muted)"><ChevronDownIcon /></span>
        </button>
      )}
      <div className="ml-auto shrink-0">
        <ThemeSwitch />
      </div>
      <div
        ref={panelRef}
        id={MENU_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 grid gap-4 border-b border-(--line) bg-(--surface-raised) p-4 shadow-[0_12px_24px_-12px_rgb(0_0_0/0.25)] sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] sm:px-5"
      >
        {SECTIONS.map(s => {
          const here = s === section;
          return (
            <div key={s.href} className="grid content-start gap-1">
              <h2 className="m-0 text-[11px] leading-4 font-bold tracking-[0.08em] uppercase">
                <Link
                  id={`menu-${s.label}`}
                  href={s.href}
                  aria-current={here && !page ? 'page' : undefined}
                  onClick={close}
                  className={`flex items-center gap-2 rounded-(--radius-sm) px-2 py-0.5 no-underline hover:bg-(--surface-sunken) aria-[current=page]:bg-(--primary-soft) ${here ? 'text-(--primary)' : 'text-(--ink-muted)'}`}
                >
                  {s.label}
                  {here && !page && <YouAreHere />}
                </Link>
              </h2>
              <ul aria-labelledby={`menu-${s.label}`} className="m-0 grid list-none gap-0.5 p-0">
                {s.pages.map(p => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      aria-current={p === page ? 'page' : undefined}
                      onClick={close}
                      className="grid gap-0.5 rounded-(--radius-sm) px-2 py-1.5 text-(--ink) no-underline hover:bg-(--surface-sunken) aria-[current=page]:bg-(--primary-soft)"
                    >
                      <span className="flex justify-between gap-3 text-[14px] font-semibold">
                        {p.title}
                        {p === page && <YouAreHere />}
                      </span>
                      <span className="text-[13px] leading-5 text-(--ink-muted)">{p.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function YouAreHere() {
  return (
    <span className="text-[12px] font-medium tracking-normal text-(--ink-muted) normal-case">
      You are here
    </span>
  );
}
