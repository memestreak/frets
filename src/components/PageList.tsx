import Link from 'next/link';
import type { Page } from './sections';

/**
 * A card per page, each linking to it: the home page's list of a section.
 * `heading` is the level of each card's title under the page's outline.
 */
export function PageList(
  { pages, heading: H }: { pages: readonly Page[]; heading: 'h2' | 'h3' },
) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {pages.map(p => (
        <li key={p.href}>
          <Link href={p.href} className="card block text-inherit no-underline transition-colors hover:border-(--line-strong)">
            <H className="m-0 text-[17px] leading-6">{p.title}</H>
            <p className="mt-1.5 mb-0">{p.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
