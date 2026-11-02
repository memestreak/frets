import { fireEvent, screen } from '@testing-library/react';
import { PANELS } from '@/features/tab/TabRail';

/**
 * A palette tool's button, opening the rail panel that holds it first if it is not open (issue #301):
 * the tests press tools from every panel, and the page shows one panel at a time.
 */
export function tool(name: string | RegExp): HTMLElement {
  const shown = screen.queryByRole('button', { name });
  if (shown) return shown;
  for (const panel of PANELS) {
    const opener = screen.getByRole('button', { name: panel.name });
    if (opener.getAttribute('aria-pressed') !== 'true') fireEvent.click(opener);
    const found = screen.queryByRole('button', { name });
    if (found) return found;
  }
  // Not in any panel: fail as getByRole does.
  return screen.getByRole('button', { name });
}
