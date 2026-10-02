import Link from 'next/link';

export type Section = 'intervals' | 'notes';

const SECTIONS: { id: Section; href: string; label: string; title: string }[] = [
  { id: 'intervals', href: '/intervals', label: 'Intervals', title: 'Interval trainer' },
  { id: 'notes', href: '/notes', label: 'Notes', title: 'Note trainer' },
];

export function AppNav({ active }: { active: Section }) {
  return (
    <nav
      className="nav flex-wrap gap-x-2.5 border-b border-(--color-divider) px-3 py-2.5 sm:gap-x-4 sm:px-5"
      aria-label="Sections"
    >
      {/* Small enough at phone width to share one row with the switch. */}
      <div className="mr-auto flex items-center gap-x-2 sm:gap-x-3.5">
        <span className="font-(family-name:--font-monoton) text-[18px] leading-none font-normal tracking-[0.06em] text-(--color-accent) sm:text-[30px]">
          FRETS
        </span>
        <span className="font-(family-name:--font-heading) text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap text-(--color-accent) uppercase sm:text-[13px]">
          {SECTIONS.find(s => s.id === active)?.title}
        </span>
      </div>
      <div className="seg">
        {SECTIONS.map(s => (
          <Link
            key={s.id}
            href={s.href}
            className="seg-opt max-sm:px-2.5"
            aria-current={s.id === active ? 'page' : undefined}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
