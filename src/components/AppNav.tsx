import Link from 'next/link';

export type Section = 'intervals' | 'notes';

const SECTIONS: { id: Section; href: string; label: string }[] = [
  { id: 'intervals', href: '/intervals', label: 'Intervals' },
  { id: 'notes', href: '/notes', label: 'Notes' },
];
const LATER = ['Chords', 'Scales', 'Ear training'];

export function AppNav({ active }: { active: Section }) {
  return (
    <nav
      className="nav flex-wrap border-b border-(--color-divider) px-5 py-2.5"
      aria-label="Sections"
    >
      <span className="nav-brand tracking-[0.04em]">E MINOR</span>
      <div className="seg">
        {SECTIONS.map(s => (
          <Link
            key={s.id}
            href={s.href}
            className="seg-opt"
            aria-current={s.id === active ? 'page' : undefined}
          >
            {s.label}
          </Link>
        ))}
      </div>
      {LATER.map(label => (
        <span
          key={label}
          className="text-[14px] opacity-45"
          title="Coming later"
          aria-disabled="true"
        >
          {label}
        </span>
      ))}
    </nav>
  );
}
