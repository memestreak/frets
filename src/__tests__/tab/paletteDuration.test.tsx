/**
 * The palette's Duration group: the note values on a row of their own, shortest to longest,
 * with the dot and rest on the row under them.
 */
import { render, screen, within } from '@testing-library/react';
import { TabPalette } from '@/features/tab/TabPalette';

const KINDS = { bend: null, vibrato: null, tuplet: null, ottava: null, wah: null, whammy: null };
const noop = () => {};

function renderDuration() {
  render(
    <TabPalette
      isOn={() => false} kinds={KINDS} onTool={noop} onBend={noop} onTuplet={noop} onOttava={noop} onWhammy={noop}
      disabled={false} groups={['Duration']} grid={null} gridValue={4} onGrid={noop}
    />,
  );
  return screen.getByRole('group', { name: 'Duration' });
}

describe('the palette Duration group', () => {
  it('puts the note values on a row of their own, shortest to longest', () => {
    const group = renderDuration();
    const rows = group.querySelectorAll('.tab-palette-tools');
    expect(rows).toHaveLength(2);
    const names = within(rows[0] as HTMLElement).getAllByRole('button').map(b => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Sixty-fourth note', 'Thirty-second note', 'Sixteenth note', 'Eighth note', 'Quarter note', 'Half note', 'Whole note',
    ]);
  });

  it('puts the dot and rest on the row under them, and no note value', () => {
    const group = renderDuration();
    const second = group.querySelectorAll('.tab-palette-tools')[1] as HTMLElement;
    const names = within(second).getAllByRole('button').map(b => b.getAttribute('aria-label'));
    expect(names).toEqual(['Dotted, then double dotted', 'Rest']);
  });
});
