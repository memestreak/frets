import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SettingsDialog } from '@/components/quiz/SettingsDialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <SettingsDialog
        open={open}
        onClose={() => setOpen(false)}
        footnote="Standard tuning"
      >
        <button type="button">Inner</button>
      </SettingsDialog>
    </>
  );
}

function openDialog(): HTMLElement {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  return screen.getByRole('dialog', { name: 'Settings' });
}

describe('SettingsDialog', () => {
  it('is closed until opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('shows its children and footnote when open', () => {
    const dialog = openDialog();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Inner' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Standard tuning');
  });

  it('closes with Done', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with the ✕ button', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on cancel (Esc)', () => {
    const dialog = openDialog();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('follows a native close', () => {
    const dialog = openDialog() as HTMLDialogElement;
    act(() => dialog.close());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The parent heard about it: opening again works.
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('closes on a backdrop click but not on a content click', () => {
    const dialog = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Inner' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // A press and click whose target is the <dialog> itself landed on the
    // backdrop.
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open when a press inside ends on the backdrop', () => {
    const dialog = openDialog();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inner' }));
    fireEvent.click(dialog);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
