# Frets: pedagogy brainstorm

2026-10-05. A brainstorm, not a spec. Grounded in what's on `main` today
(Interval and Note trainers, Scale lab with rotation, chord ladder/clock,
♭III-style numerals) and the Chords section being built (library + lab).

Sizes: **S** about one PR on existing parts, **M** a new page reusing parts,
**L** a new engine or input model.

## The frame I'd use

Every concept gets the same three moves, which the app already half has:

1. **See it** (Explore): the concept drawn on the neck and on the strip,
   ladder or clock. Nothing to get right.
2. **Find it** (Practice): a trainer asks a question whose answer is a place
   on the neck or a name, using the shared quiz framework (`quiz/`).
3. **Hear it**: the same thing played. The app has no sound yet, and that's
   the biggest gap for most of your list (see "Prerequisite" below).

The fretboard angle that makes Frets different from a theory textbook:
harmony on guitar is *geometry*. A ♭VII borrowed chord is "the shape one
whole step down from the tonic shape"; a tritone sub is "the same dominant
shape six frets away, sharing its 3rd and 7th"; a ii–V–I is "three shapes
whose guide tones move by a fret or none". Each idea below tries to make
that geometry the thing the learner sees and drills.

## Prerequisite: sound

Functional harmony, cadences, borrowed chords and rhythm are heard ideas.
Without audio, "the ♭VI sounds dark" is a claim the learner can't check.
A small Web Audio engine (synthesised pluck or a few sampled notes; strum a
voicing, play a progression at a tempo) unlocks most of what follows.
Playback is already on the Scale lab's "later slices" list. **Size M**, no
dependencies. Honest risk: synthesised guitar sounds cheap; samples add
download weight (a few hundred KB for one string set at a handful of
pitches, pitch-shifted).

## Topic by topic

### 1. Chord progression analysis

- **Learner does:** picks or types a progression (`Am F C G`, or numerals
  `vi IV I V` in a key), sees each chord's numeral and function, and steps
  through it with ‹ › like the Scale lab's chord stepping.
- **Fretboard tie:** all chords drawn in *one position* (a 4–5 fret window)
  so the learner sees how little the hand moves; common tones stay lit
  between chords; the notes that move get an arrow or a "moved" style.
- **Reuses:** Scale lab neck and `neckNotes`, chord stepping, numeral logic
  (`diatonicChords`), Chord library voicing generator (pick the voicing
  nearest the previous one), tonal's `Chord.detect` for typed chords.
- **Analysis engine:** given chords, find the key(s) that explain most of
  them and label the rest as borrowed / secondary dominant / tritone sub.
  That classifier is where topics 2–5 meet, so it's worth designing once.
- **Size:** L (key inference + voice-leading voicing choice). A cut-down
  "numerals in a fixed key, no inference" version is M.

### 2. Parallel modes

You already have *relative* modes (Rotate: same notes, new root). Parallel
modes are the other axis: same root, different notes.

- **Learner does:** fixes a root (say A) and steps Lydian → Ionian →
  Mixolydian → Dorian → Aeolian → Phrygian → Locrian (ordered bright to
  dark, each step flats one note). Sees exactly which note changed.
- **Fretboard tie:** the one changed note per step moves one fret on the
  neck, everywhere. That's a strong visual: in a fixed position, one dot
  slides down a fret per step. Strip shows the same.
- **Reuses:** Scale lab almost entirely; it's a second "Rotate"-like
  control ("Brighter / Darker") and a highlight on the changed degree.
- **Drill:** "Name the mode": the neck shows a mode in one position on a
  known root, learner names it; or "Find the ♯4 in A Lydian".
- **Size:** S for the control in the Scale lab, S–M for the drill.
- **Why first-ish:** cheapest idea here, and it sets up borrowed chords.

### 3. Borrowed chords (modal interchange)

- **Learner does:** in a major key, sees the diatonic chord row, then a
  second row "borrowed from the parallel minor" (iv, ♭VI, ♭VII, ♭III, ii°,
  v) and optionally Dorian/Mixolydian/Lydian rows. Tapping one draws it on
  the neck against the home scale, with the "foreign" note(s) marked.
- **Fretboard tie:** the foreign note is always one fret from a home-scale
  note (♭3, ♭6, ♭7). Show it as a dot outside the scale with a ghost of the
  note it replaced.
- **Reuses:** chord strip, ladder/clock (the ladder already shows non-scale
  semitones as empty squares; a borrowed chord lights one of them),
  `diatonicChords` run on the parallel scale. Your ♭III numeral style is
  already the right one for this, since it names everything against major.
- **Size:** M (mostly a parallel-scale chord row in the Scale lab plus
  marking). Becomes a label in the progression analyser later.

### 4. Dominant substitution

Two related ideas; I'd teach secondary dominants first.

- **Secondary dominants (V/x):** each diatonic chord gets its own V7. The
  learner taps "V of ii" and sees A7 in C, with the C♯ marked as the one
  out-of-key note pulling up a fret to D. Fretboard: the leading-tone
  half-step is literally one fret.
- **Tritone substitution:** G7 and D♭7 share B and F (the guide tones,
  swapped). Show both chords in one position with their shared 3rd/7th
  pair lit; the clock view is ideal (the tritone is a diameter, and the
  two chords are a 180° rotation of each other).
- **Drill:** "Resolve it": given a dominant, find the target root; or "find
  the tritone sub's root" (6 frets / same fret on the next string set).
- **Reuses:** chord clock, ladder, Chord library voicings.
- **Size:** M each, or one M page "Dominants" holding both.

### 5. Functional harmony

- **Learner does:** sees the diatonic chords sorted into Tonic (I, iii,
  vi), Subdominant (ii, IV), Dominant (V, vii°) and why: the shared notes.
  Then a cadence player: ii–V–I, IV–V–I, V–vi (deceptive), IV–I (plagal).
- **Fretboard tie:** **guide tones.** Draw only the 3rd and 7th of each
  chord in a ii–V–I; they move by at most one fret. This is the single most
  useful fretboard insight in jazz harmony and it's barely shown anywhere.
- **Drill:** "What function?" (name T/S/D for a chord in a key); "Finish the
  cadence" (hear/see ii–V–?, pick the chord); "Guide-tone line" (find the
  next chord's 3rd or 7th within one fret of the last).
- **Reuses:** chord strip (colour by function), quiz framework, neck.
- **Size:** M. Most valuable with sound.

### 6. Rhythm

The honest take: rhythm is the least fretboard-shaped topic on your list,
and a web app judging rhythm needs input timing (tap a key or the screen),
latency calibration, and audio. Options from smallest to largest:

- **Strum patterns** (S–M): show a pattern as ↓↑ over a 1 e & a grid, play
  it on a chosen chord with a metronome. Read-only, but guitar-specific.
- **Rhythm reading tap trainer** (L): show a bar, the learner taps it,
  graded against the clock. Needs latency calibration; phones are hard.
- **Subdivision trainer** (M): metronome plays, learner taps quarters,
  then eighths, triplets, sixteenths; graded on spread.

I'd defer rhythm until audio exists, then start with strum patterns since
they connect to the Chord library.

## Other ideas that fit

- **Triads on string sets** (M): every inversion of a triad on each set of
  three adjacent strings, walked up the neck. Uses the voicing generator;
  drill "find the 1st-inversion C triad on strings G-B-e". Probably the
  most practical next drill for guitarists.
- **CAGED / position map** (M): five overlapping shapes tile the neck;
  the Scale lab gains a "position" window (already a listed later slice).
  Drill: "Which CAGED shape is this?"
- **Arpeggios over changes** (M): in a progression, show each chord's
  arpeggio within one position; the learner sees where chord tones of the
  next chord lie near their current hand.
- **Chord-tone trainer** (S): Note trainer variant: "find the ♭7 of D7 on
  the B string". Reuses the trainer framework directly. Good bridge from
  intervals to harmony.
- **Key finder / transposer** (S–M): enter chords, get likely keys and a
  capo suggestion. Falls out of the progression analyser's key inference.
- **Spaced repetition across trainers** (M): track per-item accuracy (which
  intervals, which notes on which string) and ask weak items more. Stats
  are already kept per session; this makes them steer the generator.
- **Ear training** (M after audio): hear an interval or chord quality,
  answer; then "hear it, find it on the neck".
- **Song-based lessons** (L, content-heavy): a handful of public-domain or
  chord-only examples per concept ("♭VII in rock"). Chord names aren't
  copyrightable, but this is content curation work, not code.

## Recommended order

1. **Parallel modes** in the Scale lab (S). Cheap, distinctive, sets up 3.
2. **Chord-tone trainer** (S). Bridges the existing trainers to harmony
   using the Chords work.
3. **Audio playback** (M). Unblocks 5, 6, ear training, and makes 3–4
   convincing.
4. **Borrowed chords** row in the Scale lab (M).
5. **Dominants page**: secondary dominants, then tritone subs on the clock (M).
6. **Functional harmony with guide tones** (M).
7. **Progression analyser** (L), which absorbs 4–6 as its labels.
8. **Triads on string sets / CAGED** (M each) whenever the Chord library
   voicing generator is done.
9. **Rhythm**, starting with strum patterns (S–M), later the tap trainer.

## Open questions for you

1. **Sound:** are you willing to add audio, and synthesised or sampled?
   This decides whether 5 and 6 are worth building soon.
2. **Where harmony lives:** extend the Scale lab (parallel modes, borrowed
   row, dominants as overlays) or a new **Harmony** section with its own
   pages? My lean: parallel modes and borrowed chords in the Scale lab;
   dominants, functional harmony and progressions in a new Harmony section.
3. **Audience:** jazz-leaning (guide tones, ii–V–I, tritone subs) or
   rock/pop-leaning (♭VII, ♭VI, I–V–vi–IV, power-chord shapes)? It changes
   which examples and defaults come first, not the engine.
4. **Lessons or tools:** do you want guided lesson text ("step 1 of 5"),
   or keep Frets as tools and drills with minimal prose? Everything so far
   has been tools.
5. **Progression input:** typed chord names, numerals, tap-to-build, or
   presets only? Presets only cuts the analyser from L to M.
6. **Rhythm:** in scope at all? It's the one topic that doesn't use the neck.
