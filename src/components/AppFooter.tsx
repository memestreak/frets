const REPO = 'https://github.com/memestreak/frets';

// text-inherit: footer links stay muted like the text around them, rather
// than taking the --primary colour every <a> gets.
const LINK = 'text-inherit transition-colors hover:text-(--ink)';

export function AppFooter() {
  // Set by next.config.ts; "dev" there means git was unavailable at build.
  const hash = process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev';
  return (
    <footer className="mx-auto grid w-full max-w-[1240px] gap-y-1 px-5 pt-3 pb-5 text-center text-[12px] font-medium text-(--ink-muted) sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      {/* justify-self: without it the link stretches across its grid cell;
          col-start-2 keeps it centred with the first column empty. */}
      <a
        href={REPO}
        target="_blank"
        rel="noopener noreferrer"
        className={`justify-self-center sm:col-start-2 ${LINK}`}
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
