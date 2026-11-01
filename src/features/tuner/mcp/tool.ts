/**
 * `show_tuner`, the Tuner's tool on Frets' MCP server (#283): its name and what the model is told. A first test build: standard tuning, no input, to find out which chat apps let
 * the tuner hear the mic.
 */
export const TOOL_NAME = 'show_tuner';
export const APP_URI = 'ui://tuner/app.html';

export const TOOL_DESCRIPTION = [
  'Show the Frets guitar tuner in the chat, in standard tuning (E A D G B E) at A440.',
  'The user presses Listen and plays a string; the tuner shows how far off it is.',
  'Pressing a string plays its note, which works even where the chat app keeps the mic from it.',
].join(' ');
