"""
Builds the piano soundfonts the Tab page's playback can load in place of
SONiVOX's piano (issue #124). Each is a small SF3: one preset in bank 0
(program 0, or --as-program), mono samples compressed as Ogg Vorbis, which is what alphaTab's
synthesizer reads (it skips stereo samples).

    uv run --no-project scripts/build-pianos.py salamander <flac dir> <out.sf3> [--layers 11] [--quality 2] [--rate 32000] [--as-program 0]
    uv run --no-project scripts/build-pianos.py extract <font.sf3> <out.sf3> [--program 0] [--as-program 0]

salamander: the Salamander Grand Piano's FLAC samples (CC BY 3.0, Alexander
Holm), one per minor third from A0 to C8, named like `D#4v11.flac`. Fetch
them from https://github.com/sfzinstruments/SalamanderGrandPiano (folder
Samples/). Each kept velocity layer's samples are mixed to mono, cut short
with a fade (low notes ring longer), resampled and encoded with ffmpeg's
libvorbis.

extract: one preset of an existing SF3 (FluidR3 Mono's piano, MIT), with
only the instruments and samples it uses.

Python's standard library and the ffmpeg command line only.
"""

import argparse
import array
import math
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


def extract(source: Path, program: int, bank: int) -> Font:
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
                            if not kind & 16:
                                sys.exit(f'{name_of(name)} is not Ogg Vorbis: extract reads SF3 fonts only')
                            samples.append(Sample(name_of(name), data[smpl[0] + start:smpl[0] + end], rate, key,
                                                  correction, loop_start, loop_end, kind & ~0x8000))
                        inst_zone.gens[s] = (GEN_SAMPLE_ID, sample_ids[sample])
                instruments.append(Instrument(name_of(inst[amount][0]), inst_zones))
            zone.gens[g] = (GEN_INSTRUMENT, instrument_ids[amount])

    def text(tag):
        span = info.get(tag)
        return name_of(data[span[0]:span[1]]) if span else ''

    preset = Preset(name_of(phdr[index][0]), 0, 0, preset_zones)
    return Font(f'{text(b"INAM")}: {preset.name}', text(b'ICOP'), f'One preset of {source.name}.', [preset], instruments, samples)


# — Salamander —

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# Salamander's own velocity for each layer: vN covers roughly 8 * N.
LAYER_VELOCITY = 8


def note_name(key: int) -> str:
    return f'{NOTE_NAMES[key % 12]}{key // 12 - 1}'


def ring_seconds(key: int) -> float:
    """How long a sample is kept: ten seconds at A0, down to three by C7."""
    return max(3.0, min(10.0, 10 - (key - 21) * 0.08))


def decode(path: Path, seconds: float, rate: int) -> array.array:
    """A FLAC as mono 32-bit floats, cut at a length."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', f'{seconds}', '-af', 'pan=mono|c0=0.5*c0+0.5*c1',
                          '-ar', str(rate), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    samples = array.array('f')
    samples.frombytes(raw)
    return samples


def encode(path: Path, seconds: float, rate: int, gain: float, quality: float) -> bytes:
    fade = min(1.5, seconds / 3)
    filters = f'pan=mono|c0=0.5*c0+0.5*c1,atrim=0:{seconds},afade=t=out:st={seconds - fade}:d={fade},volume={gain:.4f}'
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-af', filters, '-ar', str(rate),
                           '-c:a', 'libvorbis', '-q:a', str(quality), '-f', 'ogg', '-'],
                          check=True, capture_output=True).stdout


def salamander(folder: Path, layers: list[int], quality: float, rate: int) -> Font:
    keys = [key for key in range(21, 109) if (key - 21) % 3 == 0]
    files = {(key, layer): folder / f'{note_name(key)}v{layer}.flac' for key in keys for layer in layers}
    missing = [str(f) for f in files.values() if not f.exists()]
    if missing:
        sys.exit('missing samples: ' + ', '.join(missing))

    # One gain for the whole piano, so its loudest sample peaks just under full scale.
    peak = max(max(abs(x) for x in decode(f, 1.0, rate)) for f in files.values())
    gain = 0.95 / peak
    print(f'peak {peak:.3f}, gain {gain:.2f}', file=sys.stderr)

    # Velocity ranges split halfway between the layers' own velocities.
    centres = [layer * LAYER_VELOCITY for layer in layers]
    bounds = [0] + [(a + b) // 2 + 1 for a, b in zip(centres, centres[1:])] + [128]

    samples: list[Sample] = []
    zones: list[Zone] = []
    for k, key in enumerate(keys):
        lo = 0 if k == 0 else key - 1
        hi = 127 if k == len(keys) - 1 else key + 1
        for v, layer in enumerate(layers):
            seconds = ring_seconds(key)
            data = encode(files[(key, layer)], seconds, rate, gain, quality)
            zones.append(Zone(gens=[(GEN_KEY_RANGE, key_range(lo, hi)), (GEN_VEL_RANGE, key_range(bounds[v], bounds[v + 1] - 1)),
                                    (GEN_SAMPLE_ID, len(samples))]))
            samples.append(Sample(f'{note_name(key)}v{layer}', data, rate, key))
        print(f'{note_name(key)} done', file=sys.stderr)

    # The instrument's global zone: a release like the damper's.
    global_zone = Zone(gens=[(GEN_RELEASE_VOL_ENV, timecents(0.35))])
    name = 'Salamander Grand'
    instrument = Instrument(name[:19], [global_zone] + zones)
    preset = Preset(name[:19], 0, 0, [Zone(gens=[(GEN_INSTRUMENT, 0)])])
    layer_names = ', '.join(f'v{layer}' for layer in layers)
    return Font(name, 'Alexander Holm, CC BY 3.0', f'Mono, {rate} Hz, velocity layers {layer_names}; built by Frets\' scripts/build-pianos.py.',
                [preset], [instrument], samples)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    s = sub.add_parser('salamander')
    s.add_argument('folder', type=Path)
    s.add_argument('out', type=Path)
    s.add_argument('--layers', default='11', help='velocity layers to keep, e.g. 5,11,16')
    s.add_argument('--quality', type=float, default=2, help='libvorbis quality, -1 to 10')
    s.add_argument('--rate', type=int, default=32000)
    e = sub.add_parser('extract')
    e.add_argument('source', type=Path)
    e.add_argument('out', type=Path)
    e.add_argument('--program', type=int, default=0)
    e.add_argument('--bank', type=int, default=0)
    for command in (s, e):
        command.add_argument('--as-program', type=int, default=0, help='the program the preset is written as')
    args = parser.parse_args()

    if args.command == 'salamander':
        font = salamander(args.folder, [int(x) for x in args.layers.split(',')], args.quality, args.rate)
    else:
        font = extract(args.source, args.program, args.bank)
    font.presets[0].program = args.as_program
    write_font(font, args.out)
    print(f'{args.out}: {args.out.stat().st_size / 1e6:.2f} MB, {len(font.samples)} samples', file=sys.stderr)


if __name__ == '__main__':
    main()
