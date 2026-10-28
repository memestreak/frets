import { readFileSync } from 'node:fs';
/**
 * Playback's pure part: the clip as alphaTab's score and MIDI, and the way between its ticks and
 * the clip's columns. The sound itself needs a browser. See docs/specs/2026-10-26-tab-playback-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { clickSoundFont, clickWave, ACCENT_KEY, BEAT_KEY } from '@/features/tab/click';
import {
  midiUntil, noteAlone, columnAtTick, countInBefore, countOf, COUNT_IN_CHANNEL, DEFAULT_SOUND, isSound, METRONOME_CHANNEL, perform, OWN_FONTS,
  SOUND_FAMILIES, tickOf, ticksOf, withCountIn,
} from '@/features/tab/playback';
import { parsePlaybackSettings } from '@/features/tab/PlaybackFooter';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** alphaTab's ticks: 960 to a quarter note. */
const Q = 960;

/** The clip's performance without the metronome's clicks (or the room for a count-in before it). */
function plain(clip: Clip) {
  return perform(alphaTab, clip, DEFAULT_SOUND, { clicks: false });
}

/** The programs the MIDI sets, from its program changes. */
function programsOf(midi: alphaTab.midi.MidiFile): number[] {
  return midi.events
    .filter(e => e.type === alphaTab.midi.MidiEventType.ProgramChange)
    .map(e => (e as alphaTab.midi.ProgramChangeEvent).program);
}

function noteOns(midi: alphaTab.midi.MidiFile): alphaTab.midi.NoteOnEvent[] {
  return midi.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent);
}

/** The pitch bends on one MIDI channel, which bend only the notes sounding on it. */
function pitchBendsOn(midi: alphaTab.midi.MidiFile, channel: number): alphaTab.midi.PitchBendEvent[] {
  return midi.events
    .filter((e): e is alphaTab.midi.PitchBendEvent => e.type === alphaTab.midi.MidiEventType.PitchBend)
    .filter(e => e.channel === channel);
}

describe('playback sounds', () => {
  it('offers only the sounds with a soundfont of their own', () => {
    const programs = SOUND_FAMILIES.flatMap(([, sounds]) => sounds.map(([program]) => program));
    expect(new Set(programs)).toEqual(new Set(OWN_FONTS.map(f => f.program)));
    expect(isSound(DEFAULT_SOUND)).toBe(true);
    expect(isSound(24) || isSound(111) || isSound('25')).toBe(false);
  });

  it('plays a sound from its own soundfont, which alphaTab reads with sound in it', () => {
    for (const piano of OWN_FONTS) {
      expect(isSound(piano.program)).toBe(true);
      const font = readFileSync(`public${piano.url}`);
      // Rendered offline, as the player would play it: one note, which must not be silent.
      const midi = perform(alphaTab, clipOf('0.3.4 |'), piano.program).midi;
      const options = new alphaTab.synth.AudioExportOptions();
      options.soundFonts = [font];
      const output = new Proxy({ sampleRate: 44100 }, { get: (o, k) => (k in o ? o[k as 'sampleRate'] : k === 'ready' || k === 'samplesPlayed' || k === 'sampleRequest' ? { on() {} } : () => {}) });
      const synth = new alphaTab.synth.AlphaSynth(output as unknown as alphaTab.synth.ISynthOutput, 500);
      const exporter = synth.exportAudio(options, midi, [], new Map());
      let peak = 0;
      for (let chunk = exporter.render(500); chunk; chunk = exporter.render(500)) for (const x of chunk.samples) peak = Math.max(peak, Math.abs(x));
      expect(peak).toBeGreaterThan(0.01);
    }
    // Decoding every Vorbis sample takes seconds.
  }, 60_000);

  it('plays the clip in the sound chosen, whatever its alphaTex names', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    expect(new Set(programsOf(plain(clip).midi))).toEqual(new Set([DEFAULT_SOUND]));
    expect(new Set(programsOf(perform(alphaTab, clip, 40, { clicks: false }).midi))).toEqual(new Set([40]));
  });

  it('reads the saved settings, each field checked', () => {
    const options = {
      hearNotes: false, stopAtPlayhead: false, stopAtRegionEnd: false, loopPause: false, loopPauseSeconds: 1, transpose: 0,
      metronome: false, countIn: false, countInBars: 1, clickVolume: 0.8,
    };
    expect(parsePlaybackSettings(null)).toEqual({ shown: true, sound: DEFAULT_SOUND, volume: 1, ...options });
    expect(parsePlaybackSettings({ shown: true, sound: 0, volume: 0.4, hearNotes: true, stopAtPlayhead: true, stopAtRegionEnd: true, loopPause: true, loopPauseSeconds: 2.5, transpose: -5, metronome: true, countIn: true, countInBars: 3, clickVolume: 0.35 }))
      .toEqual({ shown: true, sound: 0, volume: 0.4, hearNotes: true, stopAtPlayhead: true, stopAtRegionEnd: true, loopPause: true, loopPauseSeconds: 2.5, transpose: -5, metronome: true, countIn: true, countInBars: 3, clickVolume: 0.35 });
    expect(parsePlaybackSettings({ shown: 'yes', sound: 115, volume: 2, hearNotes: 'yes', stopAtPlayhead: 1, stopAtRegionEnd: 'on', loopPause: 'on', loopPauseSeconds: 60, transpose: 1.5, metronome: 1, countIn: 'yes', countInBars: 5, clickVolume: 1.5 }))
      .toEqual({ shown: true, sound: DEFAULT_SOUND, volume: 1, ...options });
    expect(parsePlaybackSettings({ shown: false }).shown).toBe(false);
  });
});

describe('playback', () => {
  it('hears one note alone, plain, for a quarter at 120 bpm, then ringing out', () => {
    const clip = clipOf('\\tempo 60 0.6.4 (3.5{h} 5.4{b (0 4)}).2 |');
    expect(noteAlone(clip, 0, 5, 0)).toBeNull();
    expect(noteAlone(clip, 0, 1, 0)).toBeNull();
    // The 5 on the D string (the fourth from the high e), without its bend or the chord's other note.
    const alone = noteAlone(clip, 0, 1, 3)!;
    expect(alone.bars).toHaveLength(1);
    expect(alone.bars[0].tempo).toEqual({ bpm: 120 });
    const [notes] = alone.bars[0].columns;
    expect(notes.duration).toEqual({ value: 4, dots: 0 });
    expect(notes.notes).toEqual([null, null, null, { fret: 5 }, null, null]);
    const played = plain(alone);
    expect(played.endTick).toBe(Q);
  });

  it('plays each column at its tick, and finds the column sounding at any tick', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = plain(clip);
    expect(played.endTick).toBe(8 * Q);
    expect([0, 1, 2, 3].map(i => tickOf(clip, played, i))).toEqual([0, Q, 2 * Q, 4 * Q]);
    expect(columnAtTick(clip, played, Q + 10)).toBe(1);
    expect(columnAtTick(clip, played, 5 * Q)).toBe(3);
  });

  it('lets the last notes ring a little after the clip ends', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = plain(clip);
    const lastTick = Math.max(...played.midi.events.map(e => e.tick));
    expect(lastTick).toBe(played.endTick + 2 * Q);
  });

  it('plays repeats twice: the second time through finds the same columns', () => {
    const clip = clipOf('\\ro \\rc 2 0.6.2 2.6.2 | 3.6.1 |');
    const played = plain(clip);
    expect(played.endTick).toBe(12 * Q);
    expect(columnAtTick(clip, played, 4 * Q + 10)).toBe(0);
    expect(columnAtTick(clip, played, 6 * Q + 10)).toBe(1);
    expect(columnAtTick(clip, played, 8 * Q + 10)).toBe(2);
  });

  it('counts in the MIDI\'s ticks when a grace note comes before the first beat', () => {
    // alphaTab moves the whole MIDI later to make room for the grace note, but not its lookup:
    // the end must be the MIDI's, or the player never sees the clip end (Jeremy, 2026-10-28).
    const clip = clipOf('17.1.8{gr} 15.1.4 r.4 r.2 |');
    const played = plain(clip);
    const shift = played.shift;
    expect(shift).toBeGreaterThan(0);
    expect(tickOf(clip, played, 0)).toBe(0);
    expect(tickOf(clip, played, 1)).toBe(shift);
    expect(played.endTick).toBe(4 * Q + shift);
    expect(columnAtTick(clip, played, shift + 10)).toBe(1);
    const lastTick = Math.max(...played.midi.events.map(e => e.tick));
    expect(lastTick).toBe(played.endTick + 2 * Q);
  });

  it('keeps a note reached by a legato slide at its pitch under a vibrato it hears, tied notes too', () => {
    // alphaTab's vibrato wobbles round the pitch the slide left, so the 12 sounded as the 14.
    const clip = clipOf('14.1.4 15.1.16 14.1{sl}.16 12.1{v}.8 -.1{v}.4{d} 15.1.8 |');
    const played = plain(clip);
    const [from, to] = [tickOf(clip, played, 3), tickOf(clip, played, 5)];
    const bends = pitchBendsOn(played.midi, noteOns(played.midi)[0].channel)
      .filter(e => e.tick >= from && e.tick < to);
    expect(bends.length).toBeGreaterThan(10);
    // Two semitones down is 8192 - 1024; the vibrato wobbles a little either side of it.
    for (const e of bends) expect(Math.abs(e.value - (8192 - 1024))).toBeLessThan(200);
    // ...and does wobble, on the channel the note sounds on.
    const values = bends.map(e => e.value);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(50);
  });

  it.each([
    ['back to the fret it started on', '12.3{sl}.16 14.3{sl}.16 12.3{b (0 2)}.16 -.3{b (2 2)}.16 r.2{d} |', 0],
    ['on to a third fret', '12.3{sl}.16 14.3{sl}.16 15.3{b (0 2)}.16 -.3{b (2 2)}.16 r.2{d} |', 3],
  ])('bends a note reached by a run of legato slides from its own pitch: %s', (_, text, semitones) => {
    // alphaTab plays a whole run of legato slides on its first, picked note's MIDI key, so the
    // bent note is moved from that fret, not from the one just left (Hey Joe's 12 sl 14 sl 12 bent F).
    const clip = clipOf(text);
    const played = perform(alphaTab, clip);
    const [from, to] = [tickOf(clip, played, 2), tickOf(clip, played, 4)];
    // One picked G, which the slides and the bend move; the bend goes on the channel it sounds on,
    // not on alphaTab's second channel for bent notes, where nothing sounds.
    const ons = noteOns(played.midi);
    expect(ons.map(e => e.noteKey)).toEqual([67]);
    const sounded = pitchBendsOn(played.midi, ons[0].channel)
      .filter(e => e.tick >= from && e.tick < to)
      .map(e => (e.value - 8192) / 512);
    expect(Math.min(...sounded)).toBeCloseTo(semitones, 0);
    expect(Math.max(...sounded)).toBeCloseTo(semitones + 1, 0);
  });

  it('gives a loop the ticks from its first column to the end of its last', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    expect(ticksOf(clip, plain(clip), [1, 2])).toEqual({ startTick: Q, endTick: 4 * Q });
  });

  it('stops at a region\'s end in the MIDI, so its last note still sounds and rings out', () => {
    const clip = clipOf('5.3.8{d} 7.3.16 5.2.4 7.2.4 8.2.4 |');
    const played = plain(clip);
    const end = ticksOf(clip, played, [1, 1])!.endTick;
    const midi = midiUntil(alphaTab, played, end);
    const onsAt = (m: alphaTab.midi.MidiFile) => m.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent).map(e => e.tick);
    // Both notes of the region start, nothing after it does.
    expect(onsAt(midi)).toEqual(onsAt(played.midi).filter(t => t < end));
    expect(onsAt(midi)).toHaveLength(2);
    // The second note is ended by its own note-off, then rings two beats as the clip's end does.
    expect(midi.events.some(e => e instanceof alphaTab.midi.NoteOffEvent && e.tick === end)).toBe(true);
    const last = midi.events[midi.events.length - 1];
    expect(last).toBeInstanceOf(alphaTab.midi.EndOfTrackEvent);
    expect(last.tick).toBe(end + 2 * Q);
  });

});

/** The clicks on a channel: each one's tick and whether it is beat one's. */
function clicksOn(midi: alphaTab.midi.MidiFile, channel: number): [number, boolean][] {
  return midi.events
    .filter((e): e is alphaTab.midi.NoteOnEvent => e instanceof alphaTab.midi.NoteOnEvent && e.channel === channel)
    .map(e => [e.tick, e.noteKey === ACCENT_KEY]);
}

/** The loudest sample of a MIDI file rendered offline with these soundfonts. */
function peakOf(midi: alphaTab.midi.MidiFile, fonts: Uint8Array[]): number {
  const options = new alphaTab.synth.AudioExportOptions();
  options.soundFonts = fonts;
  const output = new Proxy({ sampleRate: 44100 }, { get: (o, k) => (k in o ? o[k as 'sampleRate'] : k === 'ready' || k === 'samplesPlayed' || k === 'sampleRequest' ? { on() {} } : () => {}) });
  const synth = new alphaTab.synth.AlphaSynth(output as unknown as alphaTab.synth.ISynthOutput, 500);
  const exporter = synth.exportAudio(options, midi, [], new Map());
  let peak = 0;
  for (let chunk = exporter.render(500); chunk; chunk = exporter.render(500)) for (const x of chunk.samples) peak = Math.max(peak, Math.abs(x));
  return peak;
}

describe('metronome', () => {
  it('clicks each beat, and the dotted beat in compound time', () => {
    expect(countOf(4, 4)).toEqual({ ticks: Q, clicks: 4 });
    expect(countOf(3, 4)).toEqual({ ticks: Q, clicks: 3 });
    expect(countOf(2, 2)).toEqual({ ticks: 2 * Q, clicks: 2 });
    expect(countOf(6, 8)).toEqual({ ticks: 1.5 * Q, clicks: 2 });
    expect(countOf(9, 8)).toEqual({ ticks: 1.5 * Q, clicks: 3 });
    expect(countOf(12, 8)).toEqual({ ticks: 1.5 * Q, clicks: 4 });
    // Three eighths, and odd meters, click every eighth.
    expect(countOf(3, 8)).toEqual({ ticks: Q / 2, clicks: 3 });
    expect(countOf(7, 8)).toEqual({ ticks: Q / 2, clicks: 7 });
  });

  it('puts its clicks in the MIDI, beat one higher, following time signature changes', () => {
    const clip = clipOf('\\ts (2 4) 0.6.2 | \\ts (6 8) 0.6.2{d} | 0.6.4{tu 3} 0.6.4{tu 3} 0.6.4{tu 3} 0.6.4 |');
    const played = perform(alphaTab, clip);
    const at = played.start;
    expect(clicksOn(played.midi, METRONOME_CHANNEL)).toEqual([
      [at, true], [at + Q, false],
      [at + 2 * Q, true], [at + 3.5 * Q, false],
      // A tuplet doesn't move the beat, and 6/8 holds from the bar it was set in.
      [at + 5 * Q, true], [at + 6.5 * Q, false],
    ]);
    // Without clicks, none.
    expect(clicksOn(plain(clip).midi, METRONOME_CHANNEL)).toEqual([]);
  });

  it('clicks every time a repeat is played', () => {
    const played = perform(alphaTab, clipOf('\\ro \\rc 2 0.6.1 | 3.6.1 |'));
    expect(clicksOn(played.midi, METRONOME_CHANNEL).map(([t, accent]) => [(t - played.start) / Q, accent])).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(b => [b, b % 4 === 0]),
    );
  });

  it('leaves room for four bars of count-in before the clip, and keeps every tick after it', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = perform(alphaTab, clip);
    expect(played.start).toBe(16 * Q);
    expect(tickOf(clip, played, 0)).toBe(16 * Q);
    expect(played.endTick).toBe(24 * Q);
    expect(columnAtTick(clip, played, 17 * Q + 10)).toBe(1);
    // Room for the longest bar's count-in, even after a shorter first bar: 4/4's four bars, less the 2/4 bar before it.
    expect(perform(alphaTab, clipOf('\\ts (2 4) 0.6.2 | \\ts (4 4) 0.6.1 |')).start).toBe(14 * Q);
  });

  it('counts in a bar before Play, at the tempo and time signature Play starts in', () => {
    const clip = clipOf('\\tempo 90 0.6.4 2.6.4 3.6.4 5.6.4 | \\tempo 120 \\ts (6 8) 7.6.4{d} 8.6.4{d} |');
    const played = perform(alphaTab, clip);
    const from = tickOf(clip, played, 4);
    const countIn = countInBefore(played, from)!;
    // One bar of 6/8: two dotted quarters.
    expect(countIn).toEqual({ start: from - 3 * Q, end: from, count: { ticks: 1.5 * Q, clicks: 2 }, bars: 1 });
    const midi = withCountIn(alphaTab, played.midi, countIn);
    expect(clicksOn(midi, COUNT_IN_CHANNEL)).toEqual([[countIn.start, true], [countIn.start + 1.5 * Q, false]]);
    // The notes and clicks of the bar before are gone; the ones from Play on are where they were.
    const notesOn = (m: alphaTab.midi.MidiFile) => m.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent && e.channel !== COUNT_IN_CHANNEL).map(e => e.tick);
    expect(notesOn(midi).filter(t => t >= countIn.start && t < from)).toEqual([]);
    expect(notesOn(midi).filter(t => t >= from)).toEqual(notesOn(played.midi).filter(t => t >= from));
    expect(notesOn(midi).filter(t => t < countIn.start)).toEqual(notesOn(played.midi).filter(t => t < countIn.start));
    // The new tempo takes effect where the count-in starts, so it counts at 120.
    const tempos = midi.events.filter((e): e is alphaTab.midi.TempoChangeEvent => e instanceof alphaTab.midi.TempoChangeEvent);
    expect(tempos.find(e => e.beatsPerMinute === 120)?.tick).toBe(countIn.start);
    // The performance's own MIDI is left as it was.
    expect(clicksOn(played.midi, COUNT_IN_CHANNEL)).toEqual([]);
    expect(played.midi.events.filter(e => e instanceof alphaTab.midi.TempoChangeEvent).map(e => e.tick)).toContain(from);
  });

  it('counts in from the first bar too, in the room before it, for up to four bars', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 |');
    const played = perform(alphaTab, clip);
    const from = tickOf(clip, played, 0);
    const one = countInBefore(played, from)!;
    expect(one.start).toBe(from - 4 * Q);
    expect(clicksOn(withCountIn(alphaTab, played.midi, one), COUNT_IN_CHANNEL).map(([t]) => t - one.start)).toEqual([0, Q, 2 * Q, 3 * Q]);
    const four = countInBefore(played, from, 4)!;
    expect(four.start).toBe(0);
    // Sixteen clicks, beat one of each bar higher.
    expect(clicksOn(withCountIn(alphaTab, played.midi, four), COUNT_IN_CHANNEL)).toEqual(
      Array.from({ length: 16 }, (_, k) => [k * Q, k % 4 === 0]),
    );
  });

  it('counts in two bars of 6/8 as four dotted beats', () => {
    const clip = clipOf('\\ts (6 8) 0.6.4{d} 0.6.4{d} |');
    const played = perform(alphaTab, clip);
    const countIn = countInBefore(played, tickOf(clip, played, 0), 2)!;
    expect(clicksOn(withCountIn(alphaTab, played.midi, countIn), COUNT_IN_CHANNEL).map(([t, accent]) => [(t - countIn.start) / Q, accent]))
      .toEqual([[0, true], [1.5, false], [3, true], [4.5, false]]);
  });

  it('makes a click that starts and ends at silence, so it never pops', () => {
    for (const accent of [true, false]) {
      const wave = clickWave(accent);
      expect(Math.abs(wave[0])).toBeLessThan(0.01);
      expect(Math.abs(wave[wave.length - 1])).toBe(0);
      expect(Math.max(...wave.map(Math.abs))).toBeGreaterThan(0.5);
    }
    expect(ACCENT_KEY).not.toBe(BEAT_KEY);
  });

  it('sounds its clicks from its own soundfont in alphaTab', () => {
    const sonivox = new Uint8Array(readFileSync('public/soundfont/sonivox.sf3'));
    const rests = clipOf('r.1 |');
    expect(peakOf(perform(alphaTab, rests).midi, [sonivox, clickSoundFont()])).toBeGreaterThan(0.05);
    expect(peakOf(plain(rests).midi, [sonivox, clickSoundFont()])).toBeLessThan(0.001);
  }, 30_000);
});
