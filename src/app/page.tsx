import { PageList } from '@/components/PageList';
import { SECTIONS } from '@/components/sections';

export default function Home() {
  return (
    <div className="grid gap-8">
      <h1 className="sr-only">Frets</h1>
      {SECTIONS.map(s => (
        <section key={s.label} className="grid gap-3">
          <header>
            <h2 className="m-0">{s.label}</h2>
            <p className="mt-1 mb-0">{s.summary}</p>
          </header>
          <PageList pages={s.pages} heading="h3" />
        </section>
      ))}
    </div>
  );
}
