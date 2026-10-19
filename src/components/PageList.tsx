import Link from 'next/link';
import { PageIcon } from './PageIcon';
import type { Page } from './sections';

/**
 * A card per page, each linking to it, with the page's icon beside its
 * title: the body of the home page and the Practice page.
 * `heading` is the level of each card's title under the page's outline.
 */
export function PageList(
  { pages, heading: H }: { pages: readonly Page[]; heading: 'h2' | 'h3' },
) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {pages.map(p => (
        <li key={p.href}>
          <Link
            href={p.href}
            className="card h-full flex-row items-start gap-4 text-inherit no-underline transition-colors hover:border-(--line-strong)"
          >
            <PageIcon href={p.href} />
            <div>
              <H className="m-0 mb-1.5 text-[17px] leading-6">{p.title}</H>
              <p className="m-0">{p.summary}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
