"""
Builds the soundfonts the Tab page's playback loads for a sound in place of
SONiVOX's (issue #124). Each is a small SF3: one preset in bank 0 (program 0,
or --as-program), mono samples compressed as Ogg Vorbis, which is what
alphaTab's synthesizer reads (it skips stereo samples).

    uv run --no-project scripts/build-soundfonts.py salamander <flac dir> <out.sf3> [--layers 11] [--quality 2] [--rate 32000]
    uv run --no-project scripts/build-soundfonts.py notes <wav dir> <out.sf3> --name N --copyright C [--release 0.2]
    uv run --no-project scripts/build-soundfonts.py extract <font.sf2|sf3> <out.sf3> [--program 0]

Every command takes --as-program, the program the preset is written as.

salamander: the Salamander Grand Piano's FLAC samples (CC BY 3.0, Alexander
Holm), one per minor third from A0 to C8, named like `D#4v11.flac`. Fetch
them from https://github.com/sfzinstruments/SalamanderGrandPiano (folder
Samples/).

notes: one recording per note, named by it (`A2.wav`, `Fs2.wav`), as
tonejs-instruments has them (https://github.com/nbrosowsky/tonejs-instruments).

Both mix each recording to mono, cut it short with a fade (low notes ring
longer), resample it and encode it with ffmpeg's libvorbis.

extract: one preset of an existing SF2 or SF3, with only the instruments and
samples it uses (an SF2's samples compressed on the way).

Python's standard library and the ffmpeg command line only.
"""

import argparse
import array
import math
import re
import struct
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# SoundFont 2 generator numbers (SF2.04 spec, section 8.1.2).
GEN_RELEASE_VOL_ENV = 38
GEN_INSTRUMENT = 41
GEN_KEY_RANGE = 43
GEN_VEL_RANGE = 44
GEN_SAMPLE_ID = 53

# sampleType: a mono sample (1), compressed as Ogg Vorbis (16), as MuseScore's SF3 has it.
MONO_VORBIS = 1 | 16


@dataclass
class Zone:
    """A preset's or an instrument's zone: its generators as (number, raw 16-bit amount), and raw modulator records."""
    gens: list[tuple[int, int]]
    mods: list[bytes] = field(default_factory=list)


@dataclass
class Preset:
    name: str
    program: int
    bank: int
    zones: list[Zone]


@dataclass
class Instrument:
    name: str
    zones: list[Zone]


@dataclass
class Sample:
    name: str
    data: bytes  # one Ogg Vorbis stream
    rate: int
    key: int
    correction: int = 0
    loop_start: int = 0  # in samples, from the sample's own start (SF3)
    loop_end: int = 0
    kind: int = MONO_VORBIS


@dataclass
class Font:
    name: str
    copyright: str
    comment: str
    presets: list[Preset]
    instruments: list[Instrument]
    samples: list[Sample]


def key_range(lo: int, hi: int) -> int:
    return lo | (hi << 8)


def timecents(seconds: float) -> int:
    """A time as SoundFont timecents, as a raw 16-bit amount."""
    return round(1200 * math.log2(seconds)) & 0xFFFF


# — writing —

def chunk(tag: bytes, body: bytes) -> bytes:
    pad = b'\0' if len(body) % 2 else b''
    return tag + struct.pack('<I', len(body)) + body + pad


def list_chunk(kind: bytes, body: bytes) -> bytes:
    return chunk(b'LIST', kind + body)


def zstr(text: str, size: int | None = None) -> bytes:
    raw = text.encode('ascii', 'replace')
    if size is None:
        raw += b'\0'
        return raw + (b'\0' if len(raw) % 2 else b'')
    return raw[:size - 1].ljust(size, b'\0')


def write_font(font: Font, path: Path) -> None:
    info = b''.join([
        chunk(b'ifil', struct.pack('<HH', 3, 1)),
        chunk(b'isng', zstr('EMU8000')),
        chunk(b'INAM', zstr(font.name)),
        chunk(b'ICOP', zstr(font.copyright)),
        chunk(b'ICMT', zstr(font.comment)),
    ])

    smpl = bytearray()
    shdr = bytearray()
    for sample in font.samples:
        start = len(smpl)
        smpl += sample.data
        shdr += struct.pack('<20sIIIIIBbHH', zstr(sample.name, 20), start, len(smpl),
                            sample.loop_start, sample.loop_end, sample.rate, sample.key,
                            sample.correction, 0, sample.kind)
    shdr += struct.pack('<20sIIIIIBbHH', zstr('EOS', 20), 0, 0, 0, 0, 0, 0, 0, 0, 0)
    # alphaTab's reader doesn't skip RIFF's pad byte after an odd-sized chunk, so the samples are padded to an even size.
    if len(smpl) % 2:
        smpl += b'\0'

    def zones_records(owners, header):
        heads, bags, mods, gens = bytearray(), bytearray(), bytearray(), bytearray()
        bag_count = gen_count = mod_count = 0
        for owner in owners:
            heads += header(owner, bag_count)
            for zone in owner.zones:
                bags += struct.pack('<HH', gen_count, mod_count)
                bag_count += 1
                for oper, amount in zone.gens:
                    gens += struct.pack('<HH', oper, amount)
                    gen_count += 1
                for mod in zone.mods:
                    mods += mod
                    mod_count += 1
        bags += struct.pack('<HH', gen_count, mod_count)
        mods += bytes(10)
        gens += bytes(4)
        return heads, bags, mods, gens, bag_count

    phdr, pbag, pmod, pgen, pbags = zones_records(
        font.presets, lambda p, bag: struct.pack('<20sHHHIII', zstr(p.name, 20), p.program, p.bank, bag, 0, 0, 0))
    phdr += struct.pack('<20sHHHIII', zstr('EOP', 20), 0, 0, pbags, 0, 0, 0)
    inst, ibag, imod, igen, ibags = zones_records(
        font.instruments, lambda i, bag: struct.pack('<20sH', zstr(i.name, 20), bag))
    inst += struct.pack('<20sH', zstr('EOI', 20), ibags)

    pdta = b''.join([chunk(b'phdr', phdr), chunk(b'pbag', pbag), chunk(b'pmod', pmod), chunk(b'pgen', pgen),
                     chunk(b'inst', inst), chunk(b'ibag', ibag), chunk(b'imod', imod), chunk(b'igen', igen),
                     chunk(b'shdr', shdr)])
    body = b'sfbk' + list_chunk(b'INFO', info) + list_chunk(b'sdta', chunk(b'smpl', bytes(smpl))) + list_chunk(b'pdta', pdta)
    path.write_bytes(chunk(b'RIFF', body))


# — reading (for extract) —

def read_chunks(data: bytes, start: int, end: int) -> dict[bytes, tuple[int, int]]:
    """The chunks between two offsets, by tag (a LIST by its kind), as (body start, body end)."""
    found = {}
    at = start
    while at + 8 <= end:
        tag = data[at:at + 4]
        size = struct.unpack_from('<I', data, at + 4)[0]
        body = at + 8
        if tag == b'LIST':
            found[data[body:body + 4]] = (body + 4, body + size)
        else:
            found[tag] = (body, body + size)
        at = body + size + (size % 2)
    return found


def records(data: bytes, span: tuple[int, int], fmt: str) -> list[tuple]:
    size = struct.calcsize(fmt)
    return [struct.unpack_from(fmt, data, at) for at in range(span[0], span[1], size)]


def name_of(raw: bytes) -> str:
    return raw.split(b'\0', 1)[0].decode('ascii', 'replace')


def compress(pcm: bytes, rate: int, quality: float) -> bytes:
    """16-bit mono samples as one Ogg Vorbis stream."""
    return subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', '-',
                           '-c:a', 'libvorbis', '-q:a', str(quality), '-f', 'ogg', '-'],
                          input=pcm, check=True, capture_output=True).stdout


def extract(source: Path, program: int, bank: int, quality: float) -> Font:
    data = source.read_bytes()
    top = read_chunks(data, 12, len(data))
    info = read_chunks(data, *top[b'INFO'])
    smpl = read_chunks(data, *top[b'sdta'])[b'smpl']
    pdta = read_chunks(data, *top[b'pdta'])
    phdr = records(data, pdta[b'phdr'], '<20sHHHIII')
    pbag = records(data, pdta[b'pbag'], '<HH')
    pgen = records(data, pdta[b'pgen'], '<HH')
    pmod_span = pdta[b'pmod']
    inst = records(data, pdta[b'inst'], '<20sH')
    ibag = records(data, pdta[b'ibag'], '<HH')
    igen = records(data, pdta[b'igen'], '<HH')
    imod_span = pdta[b'imod']
    shdr = records(data, pdta[b'shdr'], '<20sIIIIIBbHH')

    def mods_of(span, first, last):
        return [data[span[0] + 10 * k:span[0] + 10 * (k + 1)] for k in range(first, last)]

    def zones(bags, gens, mod_span, first_bag, last_bag):
        return [Zone(gens=list(gens[bags[b][0]:bags[b + 1][0]]), mods=mods_of(mod_span, bags[b][1], bags[b + 1][1]))
                for b in range(first_bag, last_bag)]

    index = next(k for k, p in enumerate(phdr[:-1]) if p[1] == program and p[2] == bank)
    preset_zones = zones(pbag, pgen, pmod_span, phdr[index][3], phdr[index + 1][3])

    instruments: list[Instrument] = []
    samples: list[Sample] = []
    instrument_ids: dict[int, int] = {}
    sample_ids: dict[int, int] = {}
    for zone in preset_zones:
        for g, (oper, amount) in enumerate(zone.gens):
            if oper != GEN_INSTRUMENT:
                continue
            if amount not in instrument_ids:
                instrument_ids[amount] = len(instruments)
                inst_zones = zones(ibag, igen, imod_span, inst[amount][1], inst[amount + 1][1])
                for inst_zone in inst_zones:
                    for s, (inst_oper, sample) in enumerate(inst_zone.gens):
                        if inst_oper != GEN_SAMPLE_ID:
                            continue
                        if sample not in sample_ids:
                            sample_ids[sample] = len(samples)
                            name, start, end, loop_start, loop_end, rate, key, correction, _, kind = shdr[sample]
                            if kind & 16:
                                # SF3: the Ogg stream as it is; its loop points already count from its start.
                                ogg = data[smpl[0] + start:smpl[0] + end]
                            else:
                                # SF2: 16-bit samples, compressed here; loop points made to count from the start.
                                ogg = compress(data[smpl[0] + 2 * start:smpl[0] + 2 * end], rate, quality)
                                loop_start, loop_end = loop_start - start, loop_end - start
                            if kind & 0x7 not in (0, 1):
                                sys.exit(f'{name_of(name)} is a stereo sample: alphaTab plays mono ones only')
                            samples.append(Sample(name_of(name), ogg, rate, key, correction, loop_start, loop_end, MONO_VORBIS))
                        inst_zone.gens[s] = (GEN_SAMPLE_ID, sample_ids[sample])
                instruments.append(Instrument(name_of(inst[amount][0]), inst_zones))
            zone.gens[g] = (GEN_INSTRUMENT, instrument_ids[amount])

    def text(tag):
        span = info.get(tag)
        return name_of(data[span[0]:span[1]]) if span else ''

    preset = Preset(name_of(phdr[index][0]), 0, 0, preset_zones)
    return Font(f'{text(b"INAM")}: {preset.name}', text(b'ICOP'), f'One preset of {source.name}.', [preset], instruments, samples)


# — building from recordings —

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# Salamander's own velocity for each layer: vN covers roughly 8 * N.
LAYER_VELOCITY = 8


def note_name(key: int) -> str:
    return f'{NOTE_NAMES[key % 12]}{key // 12 - 1}'


def key_of(name: str) -> int | None:
    """The MIDI key a note name stands for: `C4` is 60; `F#2`, `Fs2` and `Gb2` are 42. None for anything else."""
    match = re.fullmatch(r'([A-G])(#|s|b)?(-?\d)', name)
    if not match:
        return None
    letter, sign, octave = match.groups()
    return (int(octave) + 1) * 12 + NOTE_NAMES.index(letter) + {None: 0, '#': 1, 's': 1, 'b': -1}[sign]


def ring_seconds(key: int) -> float:
    """How long a sample is kept at most: ten seconds at A0, down to three by C7."""
    return max(3.0, min(10.0, 10 - (key - 21) * 0.08))


def duration(path: Path) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                         check=True, capture_output=True, text=True).stdout
    return float(out)


def decode(path: Path, seconds: float, rate: int) -> array.array:
    """A recording as mono 32-bit floats, cut at a length."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{seconds}', '-ac', '1',
                          '-ar', str(rate), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    samples = array.array('f')
    samples.frombytes(raw)
    return samples


def encode(path: Path, seconds: float, rate: int, gain: float, quality: float) -> bytes:
    """A recording as one mono Ogg Vorbis stream, cut at a length with a fade."""
    fade = min(1.5, seconds / 3)
    filters = f'atrim=0:{seconds},afade=t=out:st={seconds - fade}:d={fade},volume={gain:.4f}'
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-af', filters, '-ar', str(rate),
                           '-c:a', 'libvorbis', '-q:a', str(quality), '-f', 'ogg', '-'],
                          check=True, capture_output=True).stdout


def recorded(name: str, copyright: str, files: dict[tuple[int, int], Path], layers: list[int], quality: float, rate: int,
             release: float) -> Font:
    """
    An instrument from recordings, `files[(key, layer)]`: each spread over the keys halfway to its
    neighbours, each layer over the velocities halfway to the next.
    """
    keys = sorted({key for key, _ in files})
    # One gain for the whole instrument, so its loudest sample peaks just under full scale.
    peak = max(max(abs(x) for x in decode(f, 1.0, rate)) for f in files.values())
    gain = 0.95 / peak
    print(f'peak {peak:.3f}, gain {gain:.2f}', file=sys.stderr)

    centres = [layer * LAYER_VELOCITY for layer in layers]
    bounds = [0] + [(a + b) // 2 + 1 for a, b in zip(centres, centres[1:])] + [128]

    samples: list[Sample] = []
    zones: list[Zone] = []
    for k, key in enumerate(keys):
        lo = 0 if k == 0 else (keys[k - 1] + key) // 2 + 1
        hi = 127 if k == len(keys) - 1 else (key + keys[k + 1]) // 2
        for v, layer in enumerate(layers):
            path = files[(key, layer)]
            seconds = min(ring_seconds(key), duration(path))
            data = encode(path, seconds, rate, gain, quality)
            zones.append(Zone(gens=[(GEN_KEY_RANGE, key_range(lo, hi)), (GEN_VEL_RANGE, key_range(bounds[v], bounds[v + 1] - 1)),
                                    (GEN_SAMPLE_ID, len(samples))]))
            samples.append(Sample(f'{note_name(key)}v{layer}', data, rate, key))
        print(f'{note_name(key)} done', file=sys.stderr)

    # The instrument's global zone: how long a note takes to die away once let go.
    global_zone = Zone(gens=[(GEN_RELEASE_VOL_ENV, timecents(release))])
    instrument = Instrument(name[:19], [global_zone] + zones)
    preset = Preset(name[:19], 0, 0, [Zone(gens=[(GEN_INSTRUMENT, 0)])])
    return Font(name, copyright, f'Mono, {rate} Hz; built by Frets\' scripts/build-soundfonts.py.', [preset], [instrument], samples)


def salamander(folder: Path, layers: list[int], quality: float, rate: int) -> Font:
    """The Salamander Grand Piano: a FLAC every minor third from A0 to C8, per velocity layer, `D#4v11.flac`."""
    keys = [key for key in range(21, 109) if (key - 21) % 3 == 0]
    files = {(key, layer): folder / f'{note_name(key)}v{layer}.flac' for key in keys for layer in layers}
    missing = [str(f) for f in files.values() if not f.exists()]
    if missing:
        sys.exit('missing samples: ' + ', '.join(missing))
    # A release like the damper's.
    return recorded('Salamander Grand', 'Alexander Holm, CC BY 3.0', files, layers, quality, rate, 0.35)


def notes(folder: Path, name: str, copyright: str, quality: float, rate: int, release: float, sounds: dict[str, str]) -> Font:
    """
    One recording per note, named by it (`A2.wav`, `Fs2.wav`): one velocity layer. `sounds` names the
    note a misnamed recording really plays (`D5` → `Ds5`).
    """
    files = {}
    for path in sorted(folder.iterdir()):
        key = key_of(sounds.get(path.stem, path.stem))
        if key is not None:
            files[(key, 0)] = path
    if not files:
        sys.exit(f'no notes in {folder}')
    return recorded(name, copyright, files, [0], quality, rate, release)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    s = sub.add_parser('salamander')
    s.add_argument('folder', type=Path)
    s.add_argument('out', type=Path)
    s.add_argument('--layers', default='11', help='velocity layers to keep, e.g. 5,11,16')
    n = sub.add_parser('notes')
    n.add_argument('folder', type=Path)
    n.add_argument('out', type=Path)
    n.add_argument('--name', required=True)
    n.add_argument('--copyright', required=True)
    n.add_argument('--release', type=float, default=0.2, help='seconds a note takes to die away once let go')
    n.add_argument('--sounds', action='append', default=[], metavar='FILE=NOTE',
                   help='a recording named for one note that plays another, e.g. D5=Ds5')
    for command in (s, n):
        command.add_argument('--quality', type=float, default=2, help='libvorbis quality, -1 to 10')
        command.add_argument('--rate', type=int, default=32000)
    e = sub.add_parser('extract')
    e.add_argument('source', type=Path)
    e.add_argument('out', type=Path)
    e.add_argument('--program', type=int, default=0)
    e.add_argument('--bank', type=int, default=0)
    e.add_argument('--quality', type=float, default=4, help='libvorbis quality for an SF2\'s samples')
    for command in (s, n, e):
        command.add_argument('--as-program', type=int, default=0, help='the program the preset is written as')
    args = parser.parse_args()

    if args.command == 'salamander':
        font = salamander(args.folder, [int(x) for x in args.layers.split(',')], args.quality, args.rate)
    elif args.command == 'notes':
        font = notes(args.folder, args.name, args.copyright, args.quality, args.rate, args.release,
                     dict(pair.split('=', 1) for pair in args.sounds))
    else:
        font = extract(args.source, args.program, args.bank, args.quality)
    font.presets[0].program = args.as_program
    write_font(font, args.out)
    print(f'{args.out}: {args.out.stat().st_size / 1e6:.2f} MB, {len(font.samples)} samples', file=sys.stderr)


if __name__ == '__main__':
    main()
