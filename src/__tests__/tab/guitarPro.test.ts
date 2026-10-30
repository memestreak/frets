/**
 * Download Guitar Pro: every built-in arrangement, written as .gp and read back by alphaTab's own
 * Guitar Pro reader, carries the same tracks, bars, beats and notes as its alphaTex.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { builtinsFrom } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { writeGuitarProWith } from '@/features/tab/guitarPro';

type Score = alphaTab.model.Score;
type Beat = alphaTab.model.Beat;
type Note = alphaTab.model.Note;

const builtins = builtinsFrom(await readBuiltinFiles());

/** The score alphaTab reads from alphaTex, as the page's playback reads it. */
function fromAlphaTex(text: string): Score {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.logErrors = false;
  importer.initFromString(text, new alphaTab.Settings());
  return importer.readScore();
}

function fromGuitarPro(bytes: Uint8Array): Score {
  return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, new alphaTab.Settings());
}

/** What a note is to a guitarist reading it: where it is played and how. */
function noteOf(n: Note) {
  return {
    string: n.string, fret: n.fret, tied: n.isTieDestination, hammer: n.isHammerPullOrigin,
    slideIn: n.slideInType, slideOut: n.slideOutType, vibrato: n.vibrato,
    bend: n.bendType, bendPoints: n.bendPoints?.map(p => [p.offset, p.value]) ?? [],
    harmonic: n.harmonicType, harmonicValue: n.harmonicType ? n.harmonicValue : 0,
    dead: n.isDead, ghost: n.isGhost, palmMute: n.isPalmMute, letRing: n.isLetRing,
    staccato: n.isStaccato, accent: n.accentuated, trill: n.trillValue, ornament: n.ornament,
  };
}

function beatOf(b: Beat) {
  return {
    duration: b.duration, dots: b.dots, tuplet: [b.tupletNumerator, b.tupletDenominator],
    grace: b.graceType, rest: b.isRest, notes: b.notes.map(noteOf),
    tap: b.tap, pickStroke: b.pickStroke, brush: b.brushType, chord: b.chord?.name ?? null,
    text: b.text, whammy: b.whammyBarPoints?.map(p => [p.offset, p.value]) ?? [], tremolo: b.tremoloSpeed,
    fermata: b.fermata ? b.fermata.type : null, crescendo: b.crescendo, wah: b.wahPedal, ottava: b.ottava,
  };
}

/** The score as plain data: its tracks with their tunings and sounds, the bars' marks and every beat. */
function shapeOf(score: Score) {
  return {
    title: score.title, artist: score.artist, words: score.words, music: score.music,
    masterBars: score.masterBars.map((m, i) => ({
      time: [m.timeSignatureNumerator, m.timeSignatureDenominator], free: m.isFreeTime,
      repeatStart: m.isRepeatStart, repeatCount: m.repeatCount, endings: m.alternateEndings,
      section: m.section?.text ?? null, tempo: m.tempoAutomations.map(t => t.value),
      // alphaTab's Guitar Pro reader drops a double bar on the last bar, where Guitar Pro draws the final bar line anyway.
      double: m.isDoubleBar && i < score.masterBars.length - 1,
    })),
    tracks: score.tracks.map(t => ({
      name: t.name, program: t.playbackInfo.program,
      staves: t.staves.map(s => ({
        tuning: s.stringTuning.tunings, capo: s.capo,
        bars: s.bars.map(b => ({ key: [b.keySignature, b.keySignatureType], beats: b.voices[0].beats.map(beatOf) })),
      })),
    })),
  };
}

describe('Download Guitar Pro', () => {
  it.each(builtins.map(b => [`${b.folder}/${b.id}`, b] as const))('%s reads back from .gp as it reads from alphaTex', (_, example) => {
    const read = readAlphaTexWith(alphaTab, example.text);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const bytes = writeGuitarProWith(alphaTab, read.clip);
    expect(shapeOf(fromGuitarPro(bytes))).toEqual(shapeOf(fromAlphaTex(writeAlphaTex(read.clip))));
  });

  it('writes a Guitar Pro 7 file, a zip holding Content/score.gpif, with every track', () => {
    const example = builtins.find(b => b.id === 'two-guitars')!;
    const read = readAlphaTexWith(alphaTab, example.text);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const bytes = writeGuitarProWith(alphaTab, read.clip);
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
    expect(new TextDecoder('latin1').decode(bytes)).toContain('Content/score.gpif');
    expect(read.clip.tracks.length).toBe(2);
    expect(fromGuitarPro(bytes).tracks.map(t => t.name)).toEqual(read.clip.tracks.map(t => t.name ?? ''));
  });
});
