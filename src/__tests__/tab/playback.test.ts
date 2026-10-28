import { readFileSync } from 'node:fs';
/**
 * Playback's pure part: the clip as alphaTab's score and MIDI, and the way between its ticks and
 * the clip's columns. The sound itself needs a browser. See docs/specs/2026-10-26-tab-playback-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { midiUntil, noteAlone, columnAtTick, DEFAULT_SOUND, isSound, perform, OWN_FONTS, SOUND_FAMILIES, tickOf, ticksOf } from '@/features/tab/playback';
import { parsePlaybackSettings } from '@/features/tab/PlaybackFooter';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** alphaTab's ticks: 960 to a quarter note. */
const Q = 960;

/** The programs the MIDI sets, from its program changes. */
function programsOf(midi: alphaTab.midi.MidiFile): number[] {
  return midi.events
    .filter(e => e.type === alphaTab.midi.MidiEventType.ProgramChange)
    .map(e => (e as alphaTab.midi.ProgramChangeEvent).program);
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
    expect(new Set(programsOf(perform(alphaTab, clip).midi))).toEqual(new Set([DEFAULT_SOUND]));
    expect(new Set(programsOf(perform(alphaTab, clip, 40).midi))).toEqual(new Set([40]));
  });

  it('reads the saved settings, each field checked', () => {
    const options = { hearNotes: false, stopAtPlayhead: false, stopAtRegionEnd: false, loopPause: false, loopPauseSeconds: 1, transpose: 0 };
    expect(parsePlaybackSettings(null)).toEqual({ shown: false, sound: DEFAULT_SOUND, volume: 1, ...options });
    expect(parsePlaybackSettings({ shown: true, sound: 0, volume: 0.4, hearNotes: true, stopAtPlayhead: true, stopAtRegionEnd: true, loopPause: true, loopPauseSeconds: 2.5, transpose: -5 }))
      .toEqual({ shown: true, sound: 0, volume: 0.4, hearNotes: true, stopAtPlayhead: true, stopAtRegionEnd: true, loopPause: true, loopPauseSeconds: 2.5, transpose: -5 });
    expect(parsePlaybackSettings({ shown: 'yes', sound: 115, volume: 2, hearNotes: 'yes', stopAtPlayhead: 1, stopAtRegionEnd: 'on', loopPause: 'on', loopPauseSeconds: 60, transpose: 1.5 }))
      .toEqual({ shown: false, sound: DEFAULT_SOUND, volume: 1, ...options });
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
    const played = perform(alphaTab, alone);
    expect(played.endTick).toBe(Q);
  });

  it('plays each column at its tick, and finds the column sounding at any tick', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = perform(alphaTab, clip);
    expect(played.endTick).toBe(8 * Q);
    expect([0, 1, 2, 3].map(i => tickOf(clip, played, i))).toEqual([0, Q, 2 * Q, 4 * Q]);
    expect(columnAtTick(clip, played, Q + 10)).toBe(1);
    expect(columnAtTick(clip, played, 5 * Q)).toBe(3);
  });

  it('lets the last notes ring a little after the clip ends', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = perform(alphaTab, clip);
    const lastTick = Math.max(...played.midi.events.map(e => e.tick));
    expect(lastTick).toBe(played.endTick + 2 * Q);
  });

  it('plays repeats twice: the second time through finds the same columns', () => {
    const clip = clipOf('\\ro \\rc 2 0.6.2 2.6.2 | 3.6.1 |');
    const played = perform(alphaTab, clip);
    expect(played.endTick).toBe(12 * Q);
    expect(columnAtTick(clip, played, 4 * Q + 10)).toBe(0);
    expect(columnAtTick(clip, played, 6 * Q + 10)).toBe(1);
    expect(columnAtTick(clip, played, 8 * Q + 10)).toBe(2);
  });

  it('counts in the MIDI\'s ticks when a grace note comes before the first beat', () => {
    // alphaTab moves the whole MIDI later to make room for the grace note, but not its lookup:
    // the end must be the MIDI's, or the player never sees the clip end (Jeremy, 2026-10-28).
    const clip = clipOf('17.1.8{gr} 15.1.4 r.4 r.2 |');
    const played = perform(alphaTab, clip);
    const shift = played.shift;
    expect(shift).toBeGreaterThan(0);
    expect(tickOf(clip, played, 0)).toBe(0);
    expect(tickOf(clip, played, 1)).toBe(shift);
    expect(played.endTick).toBe(4 * Q + shift);
    expect(columnAtTick(clip, played, shift + 10)).toBe(1);
    const lastTick = Math.max(...played.midi.events.map(e => e.tick));
    expect(lastTick).toBe(played.endTick + 2 * Q);
  });

  it('keeps a note reached by a legato slide at its pitch under vibrato, tied notes too', () => {
    // alphaTab's vibrato wobbles round the pitch the slide left, so the 12 sounded as the 14.
    const clip = clipOf('14.1.4 15.1.16 14.1{sl}.16 12.1{v}.8 -.1{v}.4{d} 15.1.8 |');
    const played = perform(alphaTab, clip);
    const [from, to] = [tickOf(clip, played, 3), tickOf(clip, played, 5)];
    const bends = played.midi.events
      .filter((e): e is alphaTab.midi.PitchBendEvent => e.type === alphaTab.midi.MidiEventType.PitchBend)
      .filter(e => e.tick >= from && e.tick < to);
    expect(bends.length).toBeGreaterThan(10);
    // Two semitones down is 8192 - 1024; the vibrato wobbles a little either side of it.
    for (const e of bends) expect(Math.abs(e.value - (8192 - 1024))).toBeLessThan(200);
  });

  it('gives a loop the ticks from its first column to the end of its last', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    expect(ticksOf(clip, perform(alphaTab, clip), [1, 2])).toEqual({ startTick: Q, endTick: 4 * Q });
  });

  it('stops at a region\'s end in the MIDI, so its last note still sounds and rings out', () => {
    const clip = clipOf('5.3.8{d} 7.3.16 5.2.4 7.2.4 8.2.4 |');
    const played = perform(alphaTab, clip);
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
