/**
 * The MusicXML export (issue #241): every built-in arrangement writes a file the MusicXML 4.0 schema
 * accepts and alphaTab's own importer reads back as the same notes, and each mark Frets draws is written
 * as MusicXML says it (checked in the XML itself where alphaTab's importer doesn't read it).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { validateXML } from 'xmllint-wasm';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { builtinsFrom } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { type Clip } from '@/features/tab/clip';
import { divisionsOf, harmonyOf, musicXmlLosses, writeMusicXml } from '@/features/tab/musicxml';

const builtins = builtinsFrom(await readBuiltinFiles());

function clipOf(tex: string): Clip {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

function docOf(clip: Clip): Document {
  return new DOMParser().parseFromString(writeMusicXml(clip), 'application/xml');
}

/** The text of every element matching a selector, in order. */
function texts(doc: Document | Element, selector: string): string[] {
  return [...doc.querySelectorAll(selector)].map(e => e.textContent ?? '');
}

/** The notes of one staff of the first part, in order. */
function staffNotes(doc: Document, staff: 1 | 2): Element[] {
  return [...doc.querySelectorAll('part:first-of-type note')].filter(n => n.querySelector('staff')?.textContent === String(staff));
}

const SCHEMA_DIR = join(__dirname, 'musicxml');
const schemaFile = (fileName: string) => ({ fileName, contents: readFileSync(join(SCHEMA_DIR, fileName), 'utf8') });

describe('the MusicXML file', () => {
  it.each(builtins.map(b => [`${b.folder}/${b.id}`, b] as const))('%s is valid MusicXML 4.0', async (_, builtin) => {
    const result = await validateXML({
      xml: { fileName: 'clip.musicxml', contents: writeMusicXml(clipOf(builtin.text)) },
      schema: schemaFile('musicxml.xsd'),
      preload: [schemaFile('xml.xsd'), schemaFile('xlink.xsd')],
    });
    expect(result.errors.map(e => e.rawMessage)).toEqual([]);
  });

  /** Each beat of each track's tab staff: its length, tuplet, grace, rest and each note's string, fret and tie. */
  function beatsOf(score: alphaTab.model.Score): string[][] {
    return score.tracks.map(track => {
      const staff = track.staves[track.staves.length - 1];
      return staff.bars.map(bar => {
        // The tab staff's notes are its last voice (MusicXML voice 5). alphaTab rounds each note of a 5, 6 or 7
        // tuplet to its own 960 ticks a quarter and pads the bar with a 256th rest; no Frets note is a 256th.
        const voice = bar.voices[bar.voices.length - 1];
        return voice.beats.filter(beat => !(beat.isRest && beat.duration === 256)).map(beat => {
          const tuplet = beat.hasTuplet ? `t${beat.tupletNumerator}:${beat.tupletDenominator}` : '';
          const notes = beat.notes.map(n => `${n.string}/${n.fret}${n.isTieDestination ? '~' : ''}`).sort().join(' ');
          return `${beat.duration}${'.'.repeat(beat.dots)}${tuplet}${beat.graceType ? 'g' : ''}${beat.isRest ? 'r' : ''}[${notes}]`;
        }).join(' ');
      });
    });
  }

  it.each(builtins.map(b => [`${b.folder}/${b.id}`, b] as const))('%s reads back in alphaTab as the same notes', (_, builtin) => {
    const clip = clipOf(builtin.text);
    // alphaTab 1.8.4's importer loses ties under a <transpose> (a tuned-down guitar's), so it reads the file without one.
    const xml = writeMusicXml(clip).replace(/<transpose>[\s\S]*?<\/transpose>/g, '');
    const fromXml = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(xml));
    const fromTex = alphaTab.importer.ScoreLoader.loadAlphaTex(writeAlphaTex(clip));
    expect(fromXml.tracks.map(t => t.staves[1].tuning)).toEqual(fromTex.tracks.map(t => t.staves[0].tuning));
    expect(beatsOf(fromXml)).toEqual(beatsOf(fromTex));
  });

  it('is one part for each track, each with its name, sound and channel', () => {
    const doc = docOf(clipOf(builtins.find(b => b.id === 'two-guitars')!.text));
    expect(texts(doc, 'score-part > part-name')).toEqual(['Gtr I', 'Gtr II']);
    expect(texts(doc, 'midi-instrument > midi-program')).toEqual(['28', '26']);
    expect(texts(doc, 'midi-instrument > midi-channel')).toEqual(['1', '2']);
    expect(doc.querySelectorAll('part')).toHaveLength(2);
    // Every part has as many bars, and the score's marks (sections) are in the first only.
    expect([...doc.querySelectorAll('part')].map(p => p.querySelectorAll('measure').length)).toEqual([4, 4]);
    expect(texts(doc, 'part:nth-of-type(2) words')).toEqual([]);
  });

  it('writes notation on a treble staff an octave down, and the tab with the tuning and capo', () => {
    const doc = docOf(clipOf('\\tuning (E4 B3 G3 D3 A2 D2)\n\\capo 2\n0.6.4 2.5.4 0.1.2 |'));
    expect(texts(doc, 'staves')).toEqual(['2']);
    expect(texts(doc, 'clef[number="1"] > *')).toEqual(['G', '2', '-1']);
    expect(texts(doc, 'clef[number="2"] > *')).toEqual(['TAB', '5']);
    expect([...doc.querySelectorAll('staff-tuning')].map(t => `${t.getAttribute('line')}:${t.textContent?.replace(/\s/g, '')}`))
      .toEqual(['1:D2', '2:A2', '3:D3', '4:G3', '5:B3', '6:E4']);
    expect(texts(doc, 'staff-details > capo')).toEqual(['2']);
    // With the capo on 2: the low D string open sounds E2, the A string's second fret C#3, the high e open F#4.
    expect(staffNotes(doc, 1).map(n => n.querySelector('pitch')?.textContent?.replace(/\s/g, ''))).toEqual(['E2', 'C13', 'F14']);
    expect(staffNotes(doc, 2).map(n => texts(n, 'string, fret').join('/'))).toEqual(['6/0', '5/2', '1/0']);
  });

  it('writes a guitar tuned down as fingered, with the transpose that says how it sounds', () => {
    const doc = docOf(clipOf('\\tuning (D#4 A#3 F#3 C#3 G#2 D#2)\n0.6.4 2.5.4 3.2.2 |'));
    expect(texts(doc, 'transpose > chromatic')).toEqual(['-1']);
    expect(staffNotes(doc, 1).map(n => n.querySelector('pitch')?.textContent?.replace(/\s/g, ''))).toEqual(['E2', 'B2', 'D4']);
    expect(texts(doc, 'staff-tuning tuning-step')).toEqual(['D', 'G', 'C', 'F', 'A', 'D']);
    expect(texts(doc, 'staff-tuning tuning-alter')).toEqual(['1', '1', '1', '1', '1', '1']);
  });

  it('spells notes in the key, showing an accidental only where the key and the bar so far don\'t say it', () => {
    const doc = docOf(clipOf('\\ks D\n4.3.8 3.3.8 4.3.8 2.3.8 4.4.4 1.3.4 |'));
    expect(texts(doc, 'key > fifths')).toEqual(['2']);
    // G string: fret 4 is B, 3 is A#, 4 B, 2 A; D string fret 4 F#; G string fret 1 G#.
    const notes = staffNotes(doc, 1);
    expect(notes.map(n => n.querySelector('pitch')?.textContent?.replace(/\s/g, ''))).toEqual(['B3', 'A13', 'B3', 'A3', 'F13', 'G13']);
    expect(notes.map(n => n.querySelector('accidental')?.textContent ?? '')).toEqual(['', 'sharp', '', 'natural', '', 'sharp']);
    expect(staffNotes(doc, 2).some(n => n.querySelector('accidental'))).toBe(false);
  });

  it('takes the fewest divisions that make every note whole', () => {
    expect(divisionsOf(clipOf('0.6.4 0.6.4 0.6.2 |'))).toBe(1);
    expect(divisionsOf(clipOf('0.6.8 0.6.8 0.6.4 0.6.2 |'))).toBe(2);
    expect(divisionsOf(clipOf('0.6.8{tu 3} 0.6.8{tu 3} 0.6.8{tu 3} 0.6.4 0.6.2 |'))).toBe(3);
    expect(divisionsOf(clipOf('\\ts (3 4)\n0.6.2{d} |'))).toBe(1);
  });

  it('writes durations, dots, tuplets, grace notes and rests', () => {
    const doc = docOf(clipOf('3.6.8{gr} 0.6.8{tu 3} 0.6.8{tu 3} 0.6.8{tu 3} 0.6.4{d} r.8 0.6.4 |'));
    const notes = staffNotes(doc, 1);
    expect(notes.map(n => texts(n, 'type')[0])).toEqual(['eighth', 'eighth', 'eighth', 'eighth', 'quarter', 'eighth', 'quarter']);
    expect(notes.map(n => texts(n, 'duration')[0] ?? '-')).toEqual(['-', '2', '2', '2', '9', '3', '6']);
    expect(notes[0].querySelector('grace')?.getAttribute('slash')).toBe('yes');
    expect(texts(notes[1], 'time-modification > *')).toEqual(['3', '2']);
    expect(notes[1].querySelector('tuplet')?.getAttribute('type')).toBe('start');
    expect(notes[3].querySelector('tuplet')?.getAttribute('type')).toBe('stop');
    expect(notes[4].querySelectorAll('dot')).toHaveLength(1);
    expect(notes[5].querySelector('rest')).not.toBeNull();
    // The tab staff starts back at the bar's start.
    expect(texts(doc, 'backup > duration')).toEqual(['24']);
  });

  it('writes an empty bar as a bar of rest', () => {
    const clip = clipOf('0.6.1 | 0.6.1 |');
    const [track] = clip.tracks;
    const doc = docOf({ ...clip, tracks: [{ ...track, bars: [track.bars[0], { columns: [] }] }] });
    const rest = doc.querySelector('measure[number="2"] note rest');
    expect(rest?.getAttribute('measure')).toBe('yes');
  });

  it('beams eighths and shorter as Frets does, with a second beam for sixteenths', () => {
    const doc = docOf(clipOf('0.6.8 0.6.8 0.6.8 0.6.8 0.6.16 0.6.16 0.6.8 0.6.4 |'));
    const beams = staffNotes(doc, 1).map(n => [...n.querySelectorAll('beam')].map(b => `${b.getAttribute('number')}${b.textContent}`).join(','));
    expect(beams).toEqual(['1begin', '1continue', '1continue', '1end', '1begin,2begin', '1continue,2end', '1end', '']);
  });

  it('writes ties, hammer-ons, pull-offs and slides between notes on a string', () => {
    const doc = docOf(clipOf('5.3{h}.8 7.3{h}.8 5.3{sl}.8 7.3{ss}.8 9.3.8 -.3.8 5.4{sib}.8 9.4{sia sod}.8 |'));
    const tab = staffNotes(doc, 2);
    const technical = (n: Element) => [...n.querySelectorAll('technical > hammer-on, technical > pull-off')].map(e => `${e.localName}:${e.getAttribute('type')}${e.textContent}`);
    expect(tab.slice(0, 3).map(technical)).toEqual([['hammer-on:startH'], ['hammer-on:stop', 'pull-off:startP'], ['pull-off:stop']]);
    const slides = (n: Element) => [...n.querySelectorAll('notations > slide')].map(e => e.getAttribute('type'));
    expect(tab.slice(2, 5).map(slides)).toEqual([['start'], ['stop', 'start'], ['stop']]);
    expect(tab[4].querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(tab[5].querySelector('tie')?.getAttribute('type')).toBe('stop');
    expect(tab[5].querySelector('tied')?.getAttribute('type')).toBe('stop');
    expect([...tab[6].querySelectorAll('articulations > *')].map(e => e.localName)).toEqual(['scoop']);
    expect([...tab[7].querySelectorAll('articulations > *')].map(e => e.localName)).toEqual(['plop', 'falloff']);
  });

  it('writes bends up, pre-bends, releases, held bends and the whammy bar in semitones', () => {
    const doc = docOf(clipOf('7.3{b (0 4)}.4 -.3{b (4 4)}.4 -.3{b (4 0)}.4 7.3{b (0 2 0)}.4 | 7.3{b (4 4)}.4 7.3.4{tb (0 -4)} r.2 |'));
    const bends = staffNotes(doc, 2).map(n => [...n.querySelectorAll('bend')].map(b => [...b.children].map(c => c.localName === 'bend-alter' ? c.textContent : c.localName).join(' ')));
    expect(bends).toEqual([['2'], [], ['-2 release'], ['1', '-1 release'], ['2 pre-bend'], ['-2 with-bar'], []]);
  });

  it('writes harmonics, taps, dead and ghost notes, and the pinch harmonic as words', () => {
    const doc = docOf(clipOf('12.3{nh}.8 12.3{ah}.8 12.3.8{tt} x.5.8 5.5{g}.8 5.5{ph}.8 r.4 |'));
    const tab = staffNotes(doc, 2);
    expect(tab[0].querySelector('harmonic > natural')).not.toBeNull();
    expect(tab[1].querySelector('harmonic > artificial')).not.toBeNull();
    expect(tab[2].querySelector('technical > tap')).not.toBeNull();
    expect(tab[3].querySelector('notehead')?.textContent).toBe('x');
    expect(tab[4].querySelector('notehead')?.getAttribute('parentheses')).toBe('yes');
    expect(texts(doc, 'direction words')).toEqual(['P.H.']);
  });

  it('writes accents, staccato, the fermata, mordents, tremolo picking, strokes and the wah on the staff, once a chord', () => {
    const doc = docOf(clipOf('(5.2{hac} 7.3{hac}).4{sd} 5.2{st}.4{su fermata long} 5.2{umordent}.4{waho} 5.2{lmordent}.4{tp 16 wahc} |'));
    const staff = staffNotes(doc, 1);
    const marks = (n: Element) => [...n.querySelectorAll('articulations > *, ornaments > *, technical > *, fermata')].map(e => e.localName + (e.localName === 'fermata' || e.localName === 'tremolo' ? `=${e.textContent}` : ''));
    expect(staff.map(marks)).toEqual([['down-bow', 'strong-accent'], [], ['up-bow', 'fermata=square', 'staccato'], ['open', 'inverted-mordent'], ['stopped', 'mordent', 'tremolo=2']]);
    expect(staffNotes(doc, 2).some(n => n.querySelector('articulations, fermata'))).toBe(false);
  });

  it('draws vibrato as a wavy line over each run of it on a string', () => {
    const doc = docOf(clipOf('5.2{v}.4 -.2{v}.4 5.2.4 7.2{v}.4 |'));
    const lines = staffNotes(doc, 1).map(n => [...n.querySelectorAll('wavy-line')].map(w => w.getAttribute('type')).join(','));
    expect(lines).toEqual(['start', 'stop', '', 'start,stop']);
  });

  it('writes palm muting, let ring, hairpins and octave lines over their runs', () => {
    const doc = docOf(clipOf('0.6{pm}.8 0.6{pm}.8 0.6.8{cre} 0.6.8{cre} 0.6{lr}.4 12.1.4{ot 8va} |'));
    const directions = [...doc.querySelectorAll('part > measure > direction')].map(d => [...d.querySelectorAll('direction-type > *')].map(t => `${t.localName}${t.getAttribute('type') ? `:${t.getAttribute('type')}` : ''}${t.localName === 'words' ? `=${t.textContent}` : ''}`).join(' '));
    expect(directions).toEqual([
      'words=P.M. dashes:start', 'dashes:stop', 'wedge:crescendo', 'wedge:stop', 'words=let ring dashes:start', 'dashes:stop',
      'octave-shift:down', 'octave-shift:stop',
    ]);
  });

  it('writes chord names as harmonies, and as words when they don\'t start with a note', () => {
    const name = (chord: string) => docOf(clipOf(`0.6.4{ch "${chord}"} r.2{d} |`)).querySelector('harmony');
    const em = name('Em7')!;
    expect(texts(em, 'root-step')).toEqual(['E']);
    expect(em.querySelector('kind')?.textContent).toBe('minor-seventh');
    expect(em.querySelector('kind')?.getAttribute('text')).toBe('m7');
    const slash = name('F#7/C#')!;
    expect(texts(slash, 'root-alter, bass-step, bass-alter')).toEqual(['1', 'C', '1']);
    expect(name('Bbadd9')!.querySelector('kind')?.textContent).toBe('other');
    expect(harmonyOf('N.C.')).toBeNull();
    const doc = docOf(clipOf('0.6.4{ch "N.C."} r.2{d} |'));
    expect(texts(doc, 'direction words')).toEqual(['N.C.']);
  });

  it('writes repeats, endings, double bars, free time and the final bar line', () => {
    const doc = docOf(clipOf(builtins.find(b => b.id === 'repeats')!.text));
    const barlines = [...doc.querySelectorAll('barline')].map(b => [
      b.getAttribute('location'), texts(b, 'bar-style')[0] ?? '',
      ...[...b.querySelectorAll('ending, repeat')].map(e => `${e.localName}:${e.getAttribute('type') ?? e.getAttribute('direction')}${e.getAttribute('times') ? `×${e.getAttribute('times')}` : ''}${e.getAttribute('number') ? `#${e.getAttribute('number')}` : ''}`),
    ].join(' '));
    expect(barlines).toEqual([
      'left heavy-light repeat:forward',
      'left  ending:start#1', 'right light-heavy ending:stop#1 repeat:backward×2',
      'left  ending:start#2', 'right  ending:discontinue#2',
      'left heavy-light repeat:forward', 'right light-heavy repeat:backward×3',
    ]);
    const free = docOf(clipOf('0.6.1 | \\ft 0.6.1 | \\db 0.6.1 | 0.6.1 |'));
    expect([...free.querySelectorAll('barline')].map(b => `${b.closest('measure')?.getAttribute('number')}:${texts(b, 'bar-style')[0]}`))
      .toEqual(['2:dashed', '3:light-light', '4:light-heavy']);
    expect(texts(free, 'direction words')).toEqual(['Free time']);
  });

  it('writes tempo, sections and time and key changes', () => {
    const doc = docOf(clipOf('\\section ("A" "Chorus") \\tempo (100 "A little faster") 0.6.1 | \\ts (3 4) \\ks Eminor 0.6.2{d} |'));
    expect(texts(doc, 'rehearsal')).toEqual(['A']);
    expect(texts(doc, 'direction words')).toEqual(['Chorus', 'A little faster']);
    expect(texts(doc, 'metronome > *')).toEqual(['quarter', '100']);
    expect(doc.querySelector('sound')?.getAttribute('tempo')).toBe('100');
    const second = doc.querySelector('measure[number="2"] attributes')!;
    expect(texts(second, 'fifths, mode, beats, beat-type')).toEqual(['1', 'minor', '3', '4']);
  });

  it('writes the clip\'s line breaks and multi-bar rests', () => {
    const breaks = docOf(clipOf(builtins.find(b => b.id === 'outro-solo')!.text));
    expect([...breaks.querySelectorAll('part:first-of-type print[new-system="yes"]')].map(p => p.closest('measure')?.getAttribute('number'))).toEqual(['2', '6']);
    const rests = docOf(clipOf('\\multiBarRest\n0.6.1 | r.1 | r.1 | r.1 | 0.6.1 |'));
    expect([...rests.querySelectorAll('multiple-rest')].map(r => `${r.closest('measure')?.getAttribute('number')}:${r.textContent}`)).toEqual(['2:3']);
    expect(docOf(clipOf('0.6.1 | r.1 | r.1 |')).querySelector('multiple-rest')).toBeNull();
  });

  it('carries the title and credits', () => {
    const doc = docOf(clipOf('\\title "Riff"\n\\artist "Band"\n\\words "Ann"\n\\music "Bo"\n0.6.1 |'));
    expect(texts(doc, 'work-title')).toEqual(['Riff']);
    expect([...doc.querySelectorAll('creator')].map(c => `${c.getAttribute('type')}=${c.textContent}`)).toEqual(['composer=Bo', 'lyricist=Ann', 'artist=Band']);
    expect([...doc.querySelectorAll('credit')].map(c => `${texts(c, 'credit-type')[0]}=${texts(c, 'credit-words')[0]}`))
      .toEqual(['title=Riff', 'subtitle=Band', 'composer=Words by Ann', 'composer=Music by Bo']);
    // Each in the page's top half, one under another, where MuseScore takes a credit into the score's head.
    const height = Number(texts(doc, 'page-height')[0]);
    const ys = [...doc.querySelectorAll('credit-words')].map(w => Number(w.getAttribute('default-y')));
    expect(ys.every(y => y > height / 2)).toBe(true);
    expect(ys).toEqual([...ys].sort((a, b) => b - a));
  });
});

describe('musicXmlLosses', () => {
  it('names what the file leaves out: FX turned on, and alphaTex Frets keeps without drawing', () => {
    expect(musicXmlLosses(clipOf('\\title "A"\n\\artist "B"\n0.6.1 |'))).toEqual([]);
    const kept = clipOf('\\album "X"\n\\clef F4 0.6{tr 7 16}.1 |');
    expect(musicXmlLosses(kept)).toEqual(['alphaTex Frets keeps without drawing (\\album "X", \\clef F4, tr 7 16)']);
    const fx = clipOf('// frets:fx on; distortion on drive=0.5 tone=0.5; reverb on amount=0.3 decay=1.5\n0.6.1 |');
    expect(musicXmlLosses(fx)).toEqual(['the FX']);
  });
});
