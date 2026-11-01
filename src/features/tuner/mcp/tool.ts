/**
 * `show_tuner`, the Tuner's tool on Frets' MCP server (#283, `docs/specs/2026-11-01-tuner-mcp-app-design.md`):
 * its name and what the model is told. It takes no input: standard tuning only, for now (other
 * tunings: #287).
 */
export const TOOL_NAME = 'show_tuner';
export const APP_URI = 'ui://tuner/app.html';

export const TOOL_DESCRIPTION = [
  'Show the Frets guitar tuner in the chat, in standard tuning (E A D G B E) at A440.',
  'The user presses Listen and plays a string; the tuner shows the note and how far off it is.',
  'Pressing a string plays its note, which also works where the chat app keeps the mic from the tuner.',
  'The tuner reports nothing back.',
].join(' ');

/** What the tool answers: one line, for hosts without apps too. */
export const TOOL_RESULT = 'Tuner shown, in standard tuning. The user presses Listen and plays a string.';
