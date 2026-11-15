/**
 * The server's instructions (#499): the `instructions` string of its `initialize` result, which a
 * chat app passes to the model as guidance for the server as a whole. Each tool's description says
 * what that tool does; this says only what none of them can: which tool fits which request, what is
 * too long for them, and how to write about guitar music. Every chat with the connector pays for it,
 * so keep it short (`src/__tests__/mcp/server.test.ts` holds it under 400 tokens).
 */
export const SERVER_INSTRUCTIONS = [
  'Frets (https://frets.eminor.net) is a guitar fretboard app. These tools show its pages in the chat as small apps the user plays with.',
  '',
  '- show_tab: a short line of guitar music you write note by note, such as a riff, a phrase, an exercise, a scale or arpeggio run, or a few bars of chords. Use it rather than a block of ASCII tab whenever the user would want to see it on a staff, hear it or loop it.',
  '- show_metronome: when the user wants a click to practise to, or asks about a tempo, a time signature or a groove.',
  '- show_tuner: when the user wants to tune. Standard tuning only.',
  '',
  'Each call shows a new app; one already showing can\'t be changed. To change it, call again (show_metronome takes back the rhythm it last reported).',
  '',
  'A whole song or arrangement is too long for show_tab. Write it as alphaTex, as https://frets.eminor.net/tab-alphatex.txt explains, and give the user the link that opens it on the Frets Tab page.',
  '',
  'Write as guitar books do: strings 1 (high e) to 6 (low E), tempo in bpm. Give a pitch as it sounds; the staff shows it an octave higher, as guitar music is written. Call a short musical idea a phrase, a riff or a line.',
].join('\n');
