import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setUpPage, renderAt, RIFF, SLOW } from './helpers';

setUpPage();

// `docs/specs/2026-11-06-tab-show-link-design.md`: a link's ?show= picks the staff view, the tab or both for one visit.
const LINK = `#tab=${encodeURIComponent(RIFF)}`;
const pressed = (name: string) => within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name });
const staffCount = () => screen.queryAllByTestId('staff').length;
const saved = () => JSON.parse(localStorage.getItem('frets.tab.notation') ?? 'null') as { show?: string; barNumbers?: string } | null;

describe('a link’s ?show=', () => {
  it('opens the staff view over a saved Tab, without saving it, and leaves the address', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'tab' }));
    renderAt(`?theme=light&show=staff${LINK}`);
    await screen.findAllByTestId('tab-system');
    expect(pressed('Staff')).toHaveAttribute('aria-pressed', 'true');
    expect(staffCount()).toBeGreaterThan(0);
    expect(saved()?.show).toBe('tab');
    // Only ?show= goes; the other parameters stay.
    expect(window.location.search).toBe('?theme=light');
  });

  it('opens Both with nothing saved, and saves nothing', async () => {
    renderAt(`?show=both${LINK}`);
    await screen.findAllByTestId('tab-system');
    expect(pressed('Both')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByTestId('staff-join').length).toBeGreaterThan(0);
    expect(saved()?.show ?? 'tab').toBe('tab');
  });

  it('opens Tab over a saved Staff', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'staff' }));
    renderAt(`?show=tab${LINK}`);
    await screen.findAllByTestId('tab-system');
    expect(pressed('Tab')).toHaveAttribute('aria-pressed', 'true');
    expect(staffCount()).toBe(0);
    expect(saved()?.show).toBe('staff');
  });

  it('is ended by a press on the switch, which saves as always, even the choice the link showed', async () => {
    renderAt(`?show=both${LINK}`);
    await screen.findAllByTestId('tab-system');
    fireEvent.click(pressed('Both'));
    expect(saved()?.show).toBe('both');
    fireEvent.click(pressed('Staff'));
    expect(pressed('Staff')).toHaveAttribute('aria-pressed', 'true');
    expect(saved()?.show).toBe('staff');
  });

  it('is not saved by a change in View options', async () => {
    renderAt(`?show=staff${LINK}`);
    await screen.findAllByTestId('tab-system');
    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    const panel = screen.getByRole('dialog', { name: 'View options' });
    fireEvent.click(within(panel).getByRole('button', { name: 'None' }));
    expect(saved()).toMatchObject({ barNumbers: 'none', show: 'tab' });
    expect(pressed('Staff')).toHaveAttribute('aria-pressed', 'true');
  });

  it('gives way to Settings saving another Show', async () => {
    renderAt(`?show=staff${LINK}`);
    await screen.findAllByTestId('tab-system');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Settings' }));
    fireEvent.click(dialog.getByRole('treeitem', { name: 'Notation' }));
    fireEvent.click(within(dialog.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Both' }));
    fireEvent.click(dialog.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(pressed('Both')).toHaveAttribute('aria-pressed', 'true'), SLOW);
    expect(saved()?.show).toBe('both');
  });

  it('is ignored when it names no view, and still leaves the address', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
    renderAt(`?show=notation${LINK}`);
    await screen.findAllByTestId('tab-system');
    expect(pressed('Both')).toHaveAttribute('aria-pressed', 'true');
    expect(window.location.search).toBe('');
  });
});
