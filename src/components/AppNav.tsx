'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locate, SECTIONS } from './sections';

/**
 * Wordmark (home) and one link per section. Inside a section its link names
 * the current page. Everything active is read from the URL.
 */
export function AppNav() {
  const { section, page } = locate(usePathname());
  return (
    <nav
      className="nav flex-wrap gap-x-2.5 border-b border-(--color-divider) px-3 py-2.5 sm:gap-x-4 sm:px-5"
      aria-label="Sections"
    >
      <div className="flex items-center gap-x-2 sm:gap-x-3.5">
        <Link
          href="/"
          className="font-(family-name:--font-monoton) text-[18px] leading-none font-normal tracking-[0.06em] text-(--color-accent) sm:text-[30px]"
        >
          FRETS
        </Link>
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={s === section && !page ? 'page' : undefined}
            className="font-(family-name:--font-heading) text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-(--color-accent) uppercase sm:text-[13px]"
          >
            {s === section && page ? page.title : s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
