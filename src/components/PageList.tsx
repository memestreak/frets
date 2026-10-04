import Link from 'next/link';
import type { Page } from './sections';

/** A card per page, each linking to it: the body of the index pages. */
export function PageList({ pages }: { pages: readonly Page[] }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {pages.map(p => (
        <li key={p.href}>
          <Link href={p.href} className="card block text-inherit">
            <h3 className="m-0">{p.title}</h3>
            <p className="mt-1.5 mb-0">{p.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
