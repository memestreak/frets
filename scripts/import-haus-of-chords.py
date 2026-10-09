"""
Converts Haus of Chords' chord data into the JSON the Chord library reads.

    git clone https://github.com/dersergioni/haus-of-chords /tmp/haus-of-chords
    uv run --no-project scripts/import-haus-of-chords.py /tmp/haus-of-chords

Writes src/lib/chords/data/haus-of-chords.json. Python's standard library
only (tomllib needs 3.11+). Keeps the voicings that the book counts as
published: at least two independent sources, or a `keep` from its author.
The data is CC BY 4.0; see src/lib/chords/data/README.md.
"""

import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

# Haus of Chords' file name → our chord type id (tonal's first alias).
TYPE_IDS = {
    'major': 'M', 'minor': 'm', 'power-chord': '5',
    'suspended-2nd': 'sus2', 'suspended-4th': 'sus4',
    'diminished': 'dim', 'augmented': 'aug',
    'dominant-7th': '7', 'minor-7th': 'm7', 'major-7th': 'maj7',
    'half-diminished': 'm7b5', 'diminished-7th': 'dim7', 'minor-major-7th': 'm/ma7',
    '7th-suspended-4th': '7sus4', 'augmented-7th': '7#5',
    'major-6th': '6', 'minor-6th': 'm6', 'six-nine': '6add9', 'added-9th': 'Madd9',
    'dominant-9th': '9', 'major-9th': 'maj9', 'minor-9th': 'm9', '9th-suspended-4th': '9sus4',
    'minor-11th': 'm11', 'dominant-13th': '13',
    'dominant-7-flat-9': '7b9', 'dominant-7-sharp-9': '7#9',
}

MIN_SOURCES = 2
OUT = Path(__file__).resolve().parent.parent / 'src/lib/chords/data/haus-of-chords.json'


def frets_of(strings: str) -> list[int | None]:
    """"x 3R 2M 0 1I 0" → [None, 3, 2, 0, 1, 0]: the finger letters are dropped."""
    return [None if s == 'x' else int(re.match(r'\d+', s).group()) for s in strings.split()]


def evidence_key(frets: list[int | None]) -> str:
    """[None, 3, 2, 0, 1, 0] → "x32010", and fret 10 or more in brackets: "(10)"."""
    return ''.join('x' if f is None else str(f) if f < 10 else f'({f})' for f in frets)


def independent_sources(citations: list[dict], sources: dict) -> int:
    """How many independent publishers cite a voicing, counted as data/README.md says."""
    counted = set()
    for c in citations:
        source = sources.get(c['by'], {})
        if source.get('confirms') is False:
            continue
        by = source.get('counts_as', c['by'])
        copied = source.get('copies')
        if copied and any(o['by'] == copied and o.get('fingers') == c.get('fingers') for o in citations):
            by = copied
        counted.add(by)
    return len(counted)


def main(repo: Path) -> None:
    data = repo / 'data'
    sources = tomllib.loads((data / 'sources.toml').read_text())
    commit = subprocess.run(
        ['git', '-C', str(repo), 'rev-parse', 'HEAD'], capture_output=True, text=True,
    ).stdout.strip()
    types = {}
    for name, type_id in TYPE_IDS.items():
        chords = tomllib.loads((data / 'chords' / f'{name}.toml').read_text())
        evidence = tomllib.loads((data / 'evidence' / f'{name}.toml').read_text())
        open_shapes, moveable = [], []
        for v in chords['voicings']:
            frets = frets_of(v['strings'])
            count = independent_sources(evidence.get(evidence_key(frets), []), sources)
            if count < MIN_SOURCES and 'keep' not in v:
                continue
            shape = {'shape': '-'.join('x' if f is None else str(f) for f in frets), 'sources': count}
            (open_shapes if 0 in frets else moveable).append(shape)
        types[type_id] = {'name': chords['name'], 'formula': chords['formula'],
                          'open': open_shapes, 'moveableOnC': moveable}
    # One shape per line, so a diff of a re-import reads shape by shape.
    text = json.dumps({
        'source': 'https://github.com/dersergioni/haus-of-chords',
        'commit': commit,
        'licence': 'CC BY 4.0',
        'types': types,
    }, ensure_ascii=False, indent=2)
    text = re.sub(r'\{\s+"shape": ("[^"]+"),\s+"sources": (\d+)\s+\}', r'{ "shape": \1, "sources": \2 }', text)
    OUT.write_text(text + '\n')
    total = sum(len(t['open']) + len(t['moveableOnC']) for t in types.values())
    print(f'{total} voicings in {len(types)} types → {OUT}')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
