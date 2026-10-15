import Link from 'next/link';
import { PageList } from '@/components/PageList';
import { SECTIONS } from '@/components/sections';

export default function Home() {
  return (
    <div className="grid gap-8">
      <h1 className="sr-only">Frets</h1>
      {SECTIONS.map(s => (
        <section key={s.href} className="grid gap-3">
          <header>
            <h2 className="m-0">
              <Link href={s.href} className="text-inherit">{s.label}</Link>
            </h2>
            {s.pages.length > 0 && <p className="mt-1 mb-0">{s.summary}</p>}
          </header>
          {/* A section with no pages is a page: its summary is its card. */}
          <PageList
            pages={s.pages.length ? s.pages : [{ href: s.href, summary: s.summary }]}
            heading="h3"
          />
        </section>
      ))}
    </div>
  );
}
