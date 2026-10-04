'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from './BrandMark';
import { locate, SECTIONS } from './sections';
import { ThemeSwitch } from './ThemeSwitch';

/**
 * Wordmark (home), one link per section and the theme switch. Inside a
 * section its link names the current page. Everything active is read from
 * the URL.
 */
export function AppNav() {
  const { section, page } = locate(usePathname());
  return (
    <nav
      className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-(--line) px-4 py-3 sm:px-5"
      aria-label="Sections"
    >
      <Link href="/" className="flex items-center gap-2.5 text-(--ink) no-underline">
        <BrandMark />
        <span className="font-(family-name:--font-display) text-[22px] leading-7 font-semibold">
          Frets
        </span>
      </Link>
      <div className="mr-auto flex items-center gap-x-4">
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={s === section && !page ? 'page' : undefined}
            className="text-[14px] font-semibold whitespace-nowrap text-(--ink-muted) no-underline hover:text-(--ink) aria-[current=page]:text-(--ink)"
          >
            {s === section && page ? page.title : s.label}
          </Link>
        ))}
      </div>
      <ThemeSwitch />
    </nav>
  );
}
