import Link from 'next/link';
import type { Page } from './sections';

/** A card's page: a card with no title is the summary alone. */
type PageCard = Pick<Page, 'href' | 'summary'> & { title?: string };

/**
 * A card per page, each linking to it: the body of the index pages.
 * `heading` is the level of each card's title under the page's outline.
 */
export function PageList(
  { pages, heading: H }: { pages: readonly PageCard[]; heading: 'h2' | 'h3' },
) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {pages.map(p => (
        <li key={p.href}>
          <Link href={p.href} className="card block text-inherit no-underline transition-colors hover:border-(--line-strong)">
            {p.title && <H className="m-0 mb-1.5 text-[17px] leading-6">{p.title}</H>}
            <p className="m-0">{p.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
