/**
 * Fixes to alphaTab's MIDI generator (alphaTab 1.8.4) for how Frets plays a clip: one note a string,
 * bends while tremolo picking, vibrato on bends, and a slid note keeping its pitch. They reach into the
 * generator's private fields, so an alphaTab upgrade is where they break: check each against it.
 * Split from `playback.ts` (health check, #442); `perform` there applies them.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import { STRING_COUNT, type Note, type Part } from './clip';

type AlphaTab = typeof AlphaTabModule;
type Beat = AlphaTabModule.model.Beat;
type ScoreNote = AlphaTabModule.model.Note;

/** The parts of alphaTab's MidiFileGenerator that `vibratoOnBends` steps into (alphaTab 1.8.4). */
interface GeneratorInternals {
  _handler: AlphaTabModule.midi.IMidiFileHandler;
  _generateBend(note: ScoreNote, noteStart: number, noteDuration: { noteOnly: number }, noteKey: number, channel: number, tempo: number): void;
  _generateVibrato(note: ScoreNote, noteStart: number, noteDuration: { noteOnly: number }, noteKey: number, channel: number): void;
  _generateWhammy(beat: Beat, noteStart: number, noteDuration: { noteOnly: number }, channel: number, tempo: number): void;
  _generateSlide(note: ScoreNote, noteStart: number, noteDuration: { noteOnly: number }, noteKey: number, channel: number, tempo: number): void;
  _generateNote(note: ScoreNote, beatStart: number, beatDuration: number, tempo: number, ...rest: unknown[]): void;
  _generateTremoloPicking(note: ScoreNote, noteStart: number, noteDuration: { noteOnly: number }, noteKey: number, velocity: number, channel: number): void;
  _getNoteDuration(note: ScoreNote, beatPlayDuration: number, tempo: number): NoteDuration;
  vibratoResolution: number;
}

/** How long alphaTab sounds a note, in ticks: as written, to the end of its ties or slide, and while it is let ring. */
interface NoteDuration { noteOnly: number; untilTieOrSlideEnd: number; letRingEnd: number }

/**
 * A string sounds one note at a time: a note in one Voice stops when another Voice plays on its string
 * (`docs/specs/2026-11-03-tab-voices-design.md`). alphaTab lets both ring, each its own length, so each
 * note's length is cut where the first later note on its string in another Voice starts.
 */
export function oneNoteAString(generator: AlphaTabModule.midi.MidiFileGenerator) {
  const g = generator as unknown as GeneratorInternals;
  const noteDuration = g._getNoteDuration.bind(g);
  g._getNoteDuration = (note, beatPlayDuration, tempo) => {
    const duration = noteDuration(note, beatPlayDuration, tempo);
    const { beat } = note;
    const start = beat.absolutePlaybackStart;
    const end = start + Math.max(duration.noteOnly, duration.untilTieOrSlideEnd, duration.letRingEnd);
    let cut = Infinity;
    const bars = beat.voice.bar.staff.bars;
    for (let b = beat.voice.bar.index; b < bars.length && bars[b].masterBar.start < end; b++) {
      for (const voice of bars[b].voices) {
        if (voice.index === beat.voice.index) continue;
        for (const other of voice.beats) {
          const at = other.absolutePlaybackStart;
          if (at > start && at < Math.min(end, cut) && other.notes.some(n => n.string === note.string)) cut = at;
        }
      }
    }
    if (cut === Infinity) return duration;
    const most = cut - start;
    duration.noteOnly = Math.min(duration.noteOnly, most);
    duration.untilTieOrSlideEnd = Math.min(duration.untilTieOrSlideEnd, most);
    duration.letRingEnd = Math.min(duration.letRingEnd, most);
    return duration;
  };
}

/**
 * alphaTab picks a tremolo picked note and stops there (`_generateNote` returns before the pitch
 * effects), so its whammy bar, bend, slide and vibrato never sounded (Jeremy, 2026-10-29: "I'm not
 * hearing whammy when a note also has tremolo picking"). After the picking, the note's pitch effect
 * is written the way alphaTab writes it for a note picked once.
 */
export function bendWhileTremoloPicking(at: AlphaTab, generator: AlphaTabModule.midi.MidiFileGenerator) {
  const g = generator as unknown as GeneratorInternals;
  const generateNote = g._generateNote.bind(g);
  const generateTremoloPicking = g._generateTremoloPicking.bind(g);
  // The tempo the note being written starts in, which only `_generateNote` is told.
  let tempo = 0;
  g._generateNote = (note, beatStart, beatDuration, tempoOnBeatStart, ...rest) => {
    tempo = tempoOnBeatStart;
    generateNote(note, beatStart, beatDuration, tempoOnBeatStart, ...rest);
  };
  g._generateTremoloPicking = (note, noteStart, noteDuration, noteKey, velocity, channel) => {
    // A tremolo picked note picks on through the notes tied to it, so a tied note picks no more of
    // its own: with its own `tp` too, it was picked twice over.
    const pickedBefore = note.isTieDestination && note.tieOrigin!.beat.isTremolo;
    if (!pickedBefore) generateTremoloPicking(note, noteStart, noteDuration, noteKey, velocity, channel);
    // The same choice as `_generateNote`'s, through `g` so a bend still gets `vibratoOnBends`' wobble.
    if (note.hasBend) g._generateBend(note, noteStart, noteDuration, noteKey, channel, tempo);
    else if (note.beat.hasWhammyBar && note.index === 0) g._generateWhammy(note.beat, noteStart, noteDuration, channel, tempo);
    else if (note.slideInType !== at.model.SlideInType.None || note.slideOutType !== at.model.SlideOutType.None) {
      g._generateSlide(note, noteStart, noteDuration, noteKey, channel, tempo);
    } else if (note.vibrato !== at.model.VibratoType.None || (note.isTieDestination && note.tieOrigin!.vibrato !== at.model.VibratoType.None)) {
      g._generateVibrato(note, noteStart, noteDuration, noteKey, channel);
    }
  };
}

/**
 * alphaTab plays a note's bend or its vibrato, never both (`_generateNote` picks one), so a bent note
 * with vibrato only bent, and so did the tied note a held bend ends on, which carries the bend on
 * (`b (4 4)`) (Jeremy, 2026-10-29). Each bend alphaTab writes for a note with vibrato is caught here
 * and written again with the vibrato's wobble on top of it, the way alphaTab wobbles an unbent note.
 *
 * A bent note's bend runs on through the plain ties after it, and alphaTab wobbled those ties too
 * from the bent note's vibrato, round the bend's peak, while the bend was still rising: two curves
 * at once. The wobble on the bend covers them, so their own is dropped.
 */
export function vibratoOnBends(at: AlphaTab, generator: AlphaTabModule.midi.MidiFileGenerator, settings: AlphaTabModule.Settings) {
  const g = generator as unknown as GeneratorInternals;
  const { vibrato } = settings.player;
  const generateBend = g._generateBend.bind(g);
  const generateVibrato = g._generateVibrato.bind(g);
  g._generateBend = (note, noteStart, noteDuration, noteKey, channel, tempo) => {
    if (note.vibrato === at.model.VibratoType.None) return generateBend(note, noteStart, noteDuration, noteKey, channel, tempo);
    const wide = note.vibrato === at.model.VibratoType.Wide;
    const phase = wide ? vibrato.noteWideLength : vibrato.noteSlightLength;
    const amplitude = wide ? vibrato.noteWideAmplitude : vibrato.noteSlightAmplitude;
    // The bend's points, caught on their way to the MIDI.
    const handler = g._handler;
    const points: { tick: number; value: number }[] = [];
    g._handler = Object.create(handler, {
      addNoteBend: { value: (_track: number, tick: number, _channel: number, _key: number, value: number) => points.push({ tick, value }) },
    });
    try {
      generateBend(note, noteStart, noteDuration, noteKey, channel, tempo);
    } finally {
      g._handler = handler;
    }
    if (points.length === 0) return;
    const track = note.beat.voice.bar.staff.track.index;
    const start = Math.min(noteStart, points[0].tick);
    const end = Math.max(noteStart + noteDuration.noteOnly, points[points.length - 1].tick);
    for (const { tick, value } of wobbled(points, start, end, phase, amplitude, g.vibratoResolution)) {
      handler.addNoteBend(track, tick, channel, noteKey, value);
    }
  };
  g._generateVibrato = (note, noteStart, noteDuration, noteKey, channel) => {
    const underBend = note.vibrato === at.model.VibratoType.None && note.isTieDestination && note.tieOrigin!.hasBend
      && settings.notation.extendBendArrowsOnTiedNotes;
    if (!underBend) generateVibrato(note, noteStart, noteDuration, noteKey, channel);
  };
}

/**
 * A bend's points (in pitch-wheel values, in tick order) with a vibrato on top from `start` to `end`:
 * alphaTab's own vibrato (a sine of `amplitude` quarter tones, a period every `phase` ticks, a point
 * every `step`) added to the bend's height there, read off a straight line between its points.
 */
function wobbled(points: readonly { tick: number; value: number }[], start: number, end: number, phase: number, amplitude: number, step: number) {
  const heightAt = (tick: number) => {
    let k = 0;
    while (k + 1 < points.length && points[k + 1].tick <= tick) k++;
    const [a, b] = [points[k], points[k + 1]];
    if (!b || tick <= a.tick) return a.value;
    return a.value + (b.value - a.value) * (tick - a.tick) / (b.tick - a.tick);
  };
  const out: { tick: number; value: number }[] = [];
  // What the bend sends before the vibrato starts (a pre-bend's step a tick early) is kept.
  for (const p of points) if (p.tick < start) out.push(p);
  for (let tick = start; tick < end; tick += step) {
    const wobble = amplitude / 2 * BEND_PER_SEMITONE * Math.sin(2 * Math.PI * (tick - start) / phase);
    out.push({ tick, value: Math.round(Math.max(0, Math.min(16383, heightAt(tick) + wobble))) });
  }
  out.push({ tick: end, value: Math.round(heightAt(end)) });
  return out;
}

/** alphaTab's pitch-bend range: 16 semitones either way of 8192 (the RPN it sends at the start). */
const BEND_PER_SEMITONE = 8192 / 16;

/** A note reached by a legato slide (and the notes tied to it). */
interface Span {
  /** The ticks it sounds. */
  start: number;
  end: number;
  /** The MIDI channel alphaTab writes its pitch bends on, and the one its run's note sounds on. */
  channel: number;
  to: number;
  /** How far its pitch bends are moved: from the fret of the run's MIDI key to its own. */
  by: number;
  /** The slide's last step, which alphaTab writes at the note's start from the fret just left. */
  step: number;
}

/**
 * A legato slide reaches its note by bending the note it left, so a run of legato slides sounds on
 * the MIDI key and channel of its first, picked note. alphaTab writes the pitch bends of a note the
 * run reaches (its own bend or vibrato, and the notes tied to it) as if it had a key of its own:
 * - from its own fret, so its vibrato wobbled round the pitch the slide left (the slide's 12 sounded
 *   as its 14, Jeremy, 2026-10-28);
 * - on the channel it would be picked on, which is alphaTab's second one for a note with a bend or
 *   vibrato, where nothing sounds, so 12 sl 14 sl 12 bent half a step never bent (Jeremy, 2026-10-28).
 * Those pitch bends are moved to the run's key and channel, so the note sounds as written.
 */
export function keepSlidPitch(
  at: AlphaTab, clip: Part, midi: AlphaTabModule.midi.MidiFile,
  placed: (index: number) => { start: number; beat: Beat | null },
) {
  const spans: Span[] = [];
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  // Each string's picked note sounding (the start of a run of legato slides): its fret and channel.
  const sounding: ({ fret: number; channel: number } | null)[] = Array(STRING_COUNT).fill(null);
  // Each string's slide still sounding: the span it covers so far.
  const open: (Span | null)[] = Array(STRING_COUNT).fill(null);
  let index = 0;
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      const { start, beat } = placed(index);
      const end = start + (beat?.playbackDuration ?? 0);
      column.notes.forEach((note, s) => {
        if (!note) return;
        const before = last[s];
        last[s] = note;
        if (note.tie && open[s]) {
          open[s]!.end = end;
          return;
        }
        open[s] = null;
        // alphaTab numbers strings from the highest, 1 up.
        const played = beat?.notes.find(n => n.string === STRING_COUNT - s);
        if (!played || note.fret === null) return;
        const slid = note.slide === 'legato' && before?.fret != null && note.fret !== before.fret;
        if (!slid) {
          // A tie sounds on what it is tied to; any other note is picked on a key of its own.
          if (!note.tie) sounding[s] = { fret: note.fret, channel: channelOf(at, played) };
          return;
        }
        const run = sounding[s] ?? { fret: before.fret!, channel: channelOf(at, played) };
        const span = {
          start,
          end,
          channel: channelOf(at, played),
          to: run.channel,
          by: (note.fret - run.fret) * BEND_PER_SEMITONE,
          step: (note.fret - before.fret!) * BEND_PER_SEMITONE,
        };
        spans.push(span);
        open[s] = span;
      });
      index++;
    }
  }
  if (spans.length === 0) return;
  for (const event of midi.events) {
    if (event.type !== at.midi.MidiEventType.PitchBend) continue;
    const bend = event as AlphaTabModule.midi.PitchBendEvent;
    const span = spans.find(sp => bend.tick >= sp.start && bend.tick < sp.end);
    if (!span) continue;
    if (bend.channel === span.to && bend.tick === span.start && bend.value === 8192 + span.step) {
      // The slide's own last step, landing on the note reached.
      bend.value = 8192 + span.by;
    } else if (bend.channel === span.channel) {
      bend.value = Math.max(0, Math.min(16383, bend.value + span.by));
      bend.channel = span.to;
    }
  }
}

/**
 * The MIDI channel alphaTab plays a note on (its MidiFileGenerator's `_determineChannel`): the
 * track's second channel for a note, or a note tied to it, with a bend, whammy bar or vibrato.
 */
function channelOf(at: AlphaTab, note: AlphaTabModule.model.Note): number {
  const { primaryChannel, secondaryChannel } = note.beat.voice.bar.staff.track.playbackInfo;
  const needsSecond = (n: AlphaTabModule.model.Note) =>
    n.hasBend || n.beat.hasWhammyBar || n.beat.vibrato !== at.model.VibratoType.None;
  for (let n: AlphaTabModule.model.Note | null = note; n; n = n.isTieDestination ? n.tieOrigin : null) {
    if (needsSecond(n)) return secondaryChannel;
  }
  for (let n: AlphaTabModule.model.Note | null = note; n; n = n.isTieOrigin ? n.tieDestination : null) {
    if (needsSecond(n)) return secondaryChannel;
  }
  return primaryChannel;
}
