const REPO = 'https://github.com/memestreak/frets';

// text-inherit: the design system colours every <a> with the accent, which
// is too light for text this small.
const LINK = 'text-inherit transition-colors hover:text-(--color-accent)';

export function AppFooter() {
  // Set by next.config.ts; "dev" there means git was unavailable at build.
  const hash = process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev';
  return (
    <footer className="mx-auto grid w-full max-w-[1240px] gap-y-1 px-5 pt-3 pb-5 text-center text-[10px] font-bold tracking-[0.2em] text-(--color-neutral-700) uppercase sm:grid-cols-3 sm:items-center">
      <div className="max-sm:hidden" />
      {/* justify-self: without it the link stretches across its grid cell. */}
      <a
        href={REPO}
        target="_blank"
        rel="noopener noreferrer"
        className={`justify-self-center ${LINK}`}
      >
        Source Code
      </a>
      <span className="sm:text-right">
        Built at commit{' '}
        {hash === 'dev' ? (
          hash
        ) : (
          <a
            href={`${REPO}/commit/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            {hash}
          </a>
        )}
      </span>
    </footer>
  );
}
