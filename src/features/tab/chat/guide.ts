/**
 * The agent guide to Frets' alphaTex (`public/tab-alphatex.txt`), always sent in the Chat panel's
 * system prompt and shown read-only in Settings › Tab › Chat. Fetched once a visit; '' if it can't be had.
 */
let guideText: Promise<string> | null = null;

export function loadGuide(): Promise<string> {
  guideText ??= fetch('/tab-alphatex.txt').then(r => (r.ok ? r.text() : '')).catch(() => '');
  return guideText;
}
