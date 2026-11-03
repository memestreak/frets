/**
 * The Tab page with a second Voice it doesn't draw yet: said under the clip, on paste and in Export
 * (`docs/specs/2026-11-03-tab-voices-design.md`).
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { readAscii } from '@/features/tab/ascii';
import { setUpPage, RIFF, renderAt, keepOpen, notice, paste, pageClip, editor, SLOW } from './helpers';

setUpPage();

function clipOf(text: string) {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return { ...result.clip, name: 'Voices' };
}

/** Voice 2 holds a bass under bar 1 and plays on Voice 1's string 3 in bar 2. */
const TWO_VOICES = '\\voiceMode barWise\n\\ts (4 4)\n\\voice 3.3.4 5.3.4 r.2 \\voice 0.6.1 |\n\\voice 5.3.1 \\voice r.2 7.3.2 |';

describe('TabPage voices', () => {
  it('says under the clip which bars have a hidden Voice, and where two Voices share a string, on opening a saved arrangement', () => {
    keepOpen(clipOf(TWO_VOICES));
    renderAt();
    expect(notice()).toHaveTextContent('Bars 1–2 have a second voice, not drawn yet. Bar 2 has two voices on string 3.');
  });

  it('says nothing of voices for one Voice', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    expect(notice()).not.toHaveTextContent(/voice/);
  });

  it('pastes Voice 1 of text with two Voices and says so', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    editor().focus();
    await paste('\\voiceMode barWise \\ts (4 4) \\voice 7.2.1 \\voice 0.6.1 |');
    await waitFor(() => expect(notice()).toHaveTextContent('Pasted voice 1 only.'), SLOW);
    expect(notice()).not.toHaveTextContent(/not drawn yet/);
    expect(pageClip().tracks[0].bars.every(bar => bar.voices.length === 1)).toBe(true);
  });

  it('marks ASCII, MusicXML, PNG and SVG with a ⚠ for Voice 1 only, and not alphaTex or Guitar Pro', () => {
    keepOpen(clipOf(TWO_VOICES));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Voices' });
    const format = within(dialog).getByRole('combobox', { name: 'Format' });
    for (const f of ['png', 'svg', 'ascii', 'musicxml']) {
      fireEvent.change(format, { target: { value: f } });
      expect(within(dialog).getByRole('img', { name: /^Voice 1 only; other voices aren't in this format yet\./ })).toHaveTextContent('⚠');
    }
    for (const f of ['alphatex', 'guitarPro']) {
      fireEvent.change(format, { target: { value: f } });
      expect(within(dialog).queryByRole('img', { name: /Voice 1 only/ })).toBeNull();
    }
  });
});
