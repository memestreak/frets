'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from './BrandMark';
import { locate } from './sections';
import { ThemeSwitch } from './ThemeSwitch';

const CRUMB_LINK =
  'whitespace-nowrap text-(--ink-muted) no-underline hover:text-(--ink)';

/** "›" between crumbs; decoration only. */
function Separator() {
  return <span aria-hidden="true" className="font-normal text-(--line-strong)">›</span>;
}

/**
 * The bar: the path to the current page as breadcrumbs (Frets › section ›
 * page), then the theme switch. Every crumb but the last links up; the last
 * is where you are. Read from the URL.
 */
export function AppNav() {
  const { section, page } = locate(usePathname());
  const atHome = !section;
  return (
    <header className="flex items-center gap-4 border-b border-(--line) px-4 py-3 sm:px-5">
      <nav aria-label="Breadcrumb" className="mr-auto min-w-0">
        <ol className="m-0 flex list-none items-center gap-2 p-0 text-[14px] font-semibold">
          <li className="flex">
            <Link
              href="/"
              aria-current={atHome ? 'page' : undefined}
              className="flex items-center gap-2.5 text-(--ink) no-underline"
            >
              <BrandMark />
              {/* Narrow screens keep the room for the other crumbs. */}
              <span className={`${atHome ? '' : 'sr-only sm:not-sr-only'} font-(family-name:--font-display) text-[22px] leading-7 font-semibold`}>
                Frets
              </span>
            </Link>
          </li>
          {section && (
            <li className="flex items-center gap-2">
              <Separator />
              {page ? (
                <Link href={section.href} className={CRUMB_LINK}>{section.label}</Link>
              ) : (
                <span aria-current="page">{section.label}</span>
              )}
            </li>
          )}
          {page && (
            <li className="flex min-w-0 items-center gap-2">
              <Separator />
              <span aria-current="page" className="truncate">{page.title}</span>
            </li>
          )}
        </ol>
      </nav>
      <ThemeSwitch />
    </header>
  );
}
