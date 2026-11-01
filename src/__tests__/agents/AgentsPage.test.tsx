import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AgentsPage } from '@/features/agents/AgentsPage';

describe('AgentsPage', () => {
  it('lists the skills, then the metronome connector with its URL', () => {
    render(<AgentsPage />);
    const headings = screen.getAllByRole('heading').map(h => h.textContent);
    expect(headings).toEqual(['Agents', 'Skills', 'Chords', 'Tab', 'Connectors', 'Metronome']);
    expect(screen.getByText('https://frets.eminor.net/mcp')).toBeInTheDocument();
  });

  it('copies the connector URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AgentsPage />);
    const buttons = screen.getAllByRole('button', { name: /Copy/ });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://frets.eminor.net/mcp'));
  });
});
