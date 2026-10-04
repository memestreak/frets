import Link from 'next/link';
import { PageList } from '@/components/PageList';
import { SECTIONS } from '@/components/sections';

export default function Home() {
  return (
    <div className="grid gap-8">
      {SECTIONS.map(s => (
        <section key={s.href} className="grid gap-3">
          <header>
            <h2 className="m-0">
              <Link href={s.href} className="text-inherit">{s.label}</Link>
            </h2>
            <p className="mt-1 mb-0">{s.summary}</p>
          </header>
          <PageList pages={s.pages} />
        </section>
      ))}
    </div>
  );
}
