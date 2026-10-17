const REPO = 'https://github.com/memestreak/frets';
/** The chord shapes' source and licence, credited as CC BY asks (src/lib/chords/data/README.md). */
const SHAPES_SOURCE = 'https://github.com/dersergioni/haus-of-chords';
const SHAPES_LICENCE = 'https://creativecommons.org/licenses/by/4.0/';
/** The tuner's recordings' source and licence (NOTICE.md). */
const SOUNDS_SOURCE = 'https://github.com/nbrosowsky/tonejs-instruments';
const SOUNDS_LICENCE = 'https://creativecommons.org/licenses/by/3.0/';

// text-inherit: footer links stay muted like the text around them, rather
// than taking the --primary colour every <a> gets.
const LINK = 'text-inherit transition-colors hover:text-(--ink)';

export function AppFooter() {
  // Set by next.config.ts; "dev" there means git was unavailable at build.
  const hash = process.env.NEXT_PUBLIC_COMMIT_HASH ?? 'dev';
  return (
    <footer className="mx-auto grid w-full max-w-[1240px] gap-y-1 px-5 pt-3 pb-5 text-center text-[12px] font-medium text-(--ink-muted) sm:grid-cols-3 sm:items-center">
      <span className="grid sm:text-left">
        <span>
          Chord shapes from{' '}
          <a href={SHAPES_SOURCE} target="_blank" rel="noopener noreferrer" className={LINK}>
            Haus of Chords
          </a>{' '}
          by dersergioni,{' '}
          <a href={SHAPES_LICENCE} target="_blank" rel="noopener noreferrer" className={LINK}>
            CC BY 4.0
          </a>
        </span>
        <span>
          Reference notes from{' '}
          <a href={SOUNDS_SOURCE} target="_blank" rel="noopener noreferrer" className={LINK}>
            tonejs-instruments
          </a>
          ,{' '}
          <a href={SOUNDS_LICENCE} target="_blank" rel="noopener noreferrer" className={LINK}>
            CC BY 3.0
          </a>
        </span>
      </span>
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
