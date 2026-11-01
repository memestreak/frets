/**
 * The artist, credits and tuning set from the score's head on the Tab page (issues #202, #203).
 * See docs/specs/2026-10-29-tab-credits-tuning-design.md.
 */
import { vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { BUILTIN_URL } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { emptyPart } from '@/features/tab/clip';
import { parseTabExportStyle, tabSvg } from '@/features/tab/exportTab';
import { DEFAULT_VIEW } from '@/features/tab/viewOptions';

const BUILTIN_FILES = await readBuiltinFiles();
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  return render(<TabPage />);
}
const head = () => screen.getByTestId('score-head');
const undo = () => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
const SLOW = { timeout: 5000 };
/** A press on the head's title or credits picks it; its Edit opens the panel (issue #281). */
function editFromHead(name: string | RegExp, field: 'title' | 'credits') {
  // Edit opens it on the title; a double-click on the line pressed.
  if (field === 'title') {
    fireEvent.click(within(head()).getByRole('button', { name }));
    fireEvent.click(within(head()).getByRole('button', { name: 'Edit title and credits' }));
  } else fireEvent.doubleClick(within(head()).getByRole('button', { name }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("the score head's credits", () => {
  it('are added from the space under the title, shown as typed, and kept as one undo step', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add artist and credits' }));
    const panel = screen.getByRole('dialog', { name: 'Title and credits' });
    fireEvent.change(within(panel).getByLabelText('Artist (optional)'), { target: { value: 'Band' } });
    expect(head()).toHaveTextContent('Band');
    // One set of people wrote both until said otherwise: one field, one line.
    fireEvent.change(within(panel).getByLabelText('Words & Music (optional)'), { target: { value: 'Ann' } });
    expect(head()).toHaveTextContent('Words & Music by Ann');
    fireEvent.keyDown(within(panel).getByLabelText('Artist (optional)'), { key: 'Enter' });
    expect(screen.queryByRole('dialog', { name: 'Title and credits' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add artist and credits' })).toBeNull();

    undo();
    expect(head()).not.toHaveTextContent('Band');
    expect(head()).not.toHaveTextContent('Ann');
  });

  it('go back as they were on Esc', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add artist and credits' }));
    const panel = screen.getByRole('dialog', { name: 'Title and credits' });
    const artist = within(panel).getByLabelText('Artist (optional)');
    fireEvent.change(artist, { target: { value: 'Band' } });
    fireEvent.keyDown(artist, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(head()).not.toHaveTextContent('Band');
    expect(screen.getByRole('button', { name: 'Add artist and credits' })).toBeInTheDocument();
  });

  it('open from the drawn credits, and words and music part when different people wrote them', async () => {
    renderAt('#example=tuned-down');
    await waitFor(() => expect(head()).toHaveTextContent("Guns N' Roses"), SLOW);
    editFromHead(/Guns N' Roses/, 'credits');
    const panel = screen.getByRole('dialog', { name: 'Title and credits' });
    expect(within(panel).getByLabelText('Artist (optional)')).toHaveValue("Guns N' Roses");
    fireEvent.click(within(panel).getByRole('switch', { name: 'Same people wrote both' }));
    const music = within(panel).getByLabelText('Music (optional)');
    expect(music).toHaveValue(within(panel).getByLabelText('Words (optional)').getAttribute('value'));
    fireEvent.change(music, { target: { value: 'Slash' } });
    fireEvent.keyDown(music, { key: 'Enter' });
    expect(head()).toHaveTextContent('Words by Axl Rose');
    expect(head()).toHaveTextContent('Music by Slash');
  });
});

describe("the score head's title and credits panel", () => {
  it('opens from the title or the credits, focused on the pressed one, and keeps title and credits as one undo step', () => {
    renderAt();
    editFromHead('Untitled', 'title');
    let panel = screen.getByRole('dialog', { name: 'Title and credits' });
    // Every field is in the one panel; the title is first.
    const fields = within(panel).getAllByRole('textbox').map(f => f.getAttribute('aria-label'));
    expect(fields).toEqual(['Title', 'Artist (optional)', 'Words & Music (optional)']);
    expect(within(panel).getByLabelText('Title')).toHaveFocus();
    expect(within(panel).getByLabelText('Title')).toHaveAttribute('placeholder', 'Untitled');
    fireEvent.change(within(panel).getByLabelText('Title'), { target: { value: 'Song' } });
    fireEvent.change(within(panel).getByLabelText('Artist (optional)'), { target: { value: 'Band' } });
    expect(head()).toHaveTextContent('Song');
    expect(head()).toHaveTextContent('Band');
    // A press away keeps it.
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();

    // The artist opens the same panel, on the artist's field.
    editFromHead(/Band/, 'credits');
    panel = screen.getByRole('dialog', { name: 'Title and credits' });
    expect(within(panel).getByLabelText('Artist (optional)')).toHaveFocus();
    expect(within(panel).getByLabelText('Title')).toHaveValue('Song');
    fireEvent.keyDown(within(panel).getByLabelText('Artist (optional)'), { key: 'Escape' });

    // Title and artist went in as one step.
    undo();
    expect(head()).toHaveTextContent('Untitled');
    expect(head()).not.toHaveTextContent('Band');
  });

  it('opens on the artist from "Add artist and credits", and an emptied title keeps the one it had', () => {
    renderAt();
    editFromHead('Untitled', 'title');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Riff' } });
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Add artist and credits' }));
    const panel = screen.getByRole('dialog', { name: 'Title and credits' });
    expect(within(panel).getByLabelText('Artist (optional)')).toHaveFocus();
    const title = within(panel).getByLabelText('Title');
    expect(title).toHaveValue('Riff');
    fireEvent.change(title, { target: { value: '   ' } });
    // The title is needed (issue #281): a red ⚠ while it is blank, and the head keeps the title it had.
    expect(within(panel).getByRole('img', { name: "The title can't be blank" })).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(within(head()).getByRole('heading', { level: 1 })).toHaveTextContent('Riff');
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(within(head()).getByRole('heading', { level: 1 })).toHaveTextContent('Riff');
  });

  it('has no title field of its own on the page', () => {
    renderAt();
    editFromHead('Untitled', 'title');
    expect(screen.queryByRole('textbox', { name: 'Clip title' })).toBeNull();
  });
});

describe("the score head's tuning", () => {
  it('is always shown, "Standard tuning" opening the panel; set a preset or a string at a time, each one undo step', () => {
    renderAt();
    const tuning = () => screen.getByRole('group', { name: 'Tuning' });
    expect(tuning()).toHaveTextContent(/^Standard tuning$/);
    fireEvent.doubleClick(within(tuning()).getByRole('button', { name: 'Standard tuning' }));
    const panel = screen.getByRole('dialog', { name: 'Tuning' });
    expect(within(panel).getByRole('button', { name: 'Standard' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Drop D' }));
    expect(within(head()).getByLabelText('string 6').parentElement).toHaveTextContent('6 = D');
    expect(within(panel).getByRole('button', { name: 'Drop D' })).toHaveAttribute('aria-pressed', 'true');

    // The high e down to D on the piano: Drop D is now a tuning of its own.
    fireEvent.click(within(panel).getByRole('button', { name: 'String 1: E' }));
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'String 1' })).getByRole('radio', { name: 'D' }));
    expect(within(head()).getByLabelText('string 1').parentElement).toHaveTextContent('1 = D');
    expect(within(panel).getByText('Tuning: Custom')).toBeInTheDocument();

    undo();
    expect(within(head()).queryByLabelText('string 1')).toBeNull();
    undo();
    expect(tuning()).toHaveTextContent(/^Standard tuning$/);
  });

  it('shows "Standard tuning" only in the Notation view, and never in the picture', () => {
    renderAt();
    expect(screen.getByRole('button', { name: 'Standard tuning' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.queryByRole('button', { name: 'Standard tuning' })).toBeNull();
    // Printed scores leave standard tuning unsaid.
    expect(tabSvg({ ...emptyPart(), name: 'Riff' }, parseTabExportStyle(null), 'Riff')).not.toContain('Standard tuning');
  });

  it('opens from the drawn tuning, and Standard takes the tag away', async () => {
    renderAt('#example=tuned-down');
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tuning' })).toBeInTheDocument(), SLOW);
    fireEvent.doubleClick(within(screen.getByRole('group', { name: 'Tuning' })).getByRole('button'));
    const panel = screen.getByRole('dialog', { name: 'Tuning' });
    expect(within(panel).getByRole('button', { name: 'E♭' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Standard' }));
    expect(screen.getByRole('group', { name: 'Tuning' })).toHaveTextContent(/^Standard tuning$/);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect((screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement).value).not.toContain('\\tuning');
  });
});

describe('the arrangement header (issue #281)', () => {
  const titleButton = () => within(head()).getByRole('button', { name: 'Riff' });
  const creditsButton = () => within(head()).getByRole('button', { name: /Band/ });
  const pick = () => screen.getByTestId('score-head').querySelector('.score-pick')!;
  const folded = () => document.querySelector<HTMLElement>('.tab-head-folded');
  function renderRiff() {
    renderAt();
    editFromHead('Untitled', 'title');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Riff' } });
    fireEvent.change(screen.getByLabelText('Artist (optional)'), { target: { value: 'Band' } });
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Enter' });
  }
  function collapse() {
    fireEvent.click(titleButton());
    fireEvent.click(screen.getByRole('button', { name: 'Collapse header' }));
  }

  it('picks the title and credits together on a press of either, with Edit and Collapse beside them, and opens nothing', () => {
    renderRiff();
    fireEvent.click(creditsButton());
    expect(screen.queryByRole('dialog', { name: 'Title and credits' })).toBeNull();
    // One outline round both.
    expect(pick()).toHaveClass('score-picked');
    expect(pick()).toContainElement(titleButton());
    expect(pick()).toContainElement(creditsButton());
    expect(titleButton()).toHaveAttribute('aria-pressed', 'true');
    expect(creditsButton()).toHaveAttribute('aria-pressed', 'true');
    const tools = within(screen.getByTestId('head-tools'));
    expect(tools.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Edit title and credits', 'Collapse header']);
    // A second press keeps it picked.
    fireEvent.click(titleButton());
    expect(screen.queryByRole('dialog', { name: 'Title and credits' })).toBeNull();
    expect(pick()).toHaveClass('score-picked');
  });

  it('opens the panel on Enter, Edit or a double-click, on the line pressed, and leaves nothing picked', () => {
    renderRiff();
    fireEvent.click(titleButton());
    fireEvent.keyDown(titleButton(), { key: 'Enter' });
    expect(within(screen.getByRole('dialog', { name: 'Title and credits' })).getByLabelText('Title')).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' });
    expect(pick()).not.toHaveClass('score-picked');
    fireEvent.doubleClick(creditsButton());
    expect(within(screen.getByRole('dialog', { name: 'Title and credits' })).getByLabelText('Artist (optional)')).toHaveFocus();
  });

  it('lets the pick go on Esc or when the focus leaves it', () => {
    renderRiff();
    fireEvent.click(titleButton());
    fireEvent.keyDown(titleButton(), { key: 'Escape' });
    expect(pick()).not.toHaveClass('score-picked');
    expect(screen.queryByTestId('head-tools')).toBeNull();
    fireEvent.click(creditsButton());
    fireEvent.blur(creditsButton(), { relatedTarget: document.body });
    expect(screen.queryByTestId('head-tools')).toBeNull();
  });

  it('collapses to the small title after Size, keeping the tuning and tempo', () => {
    renderRiff();
    collapse();
    expect(within(head()).queryByRole('heading')).toBeNull();
    expect(within(head()).queryByRole('button', { name: /Band/ })).toBeNull();
    expect(within(head()).getByRole('group', { name: 'Tuning' })).toBeInTheDocument();
    // The page keeps its heading for screen readers.
    expect(screen.getByRole('heading', { level: 1, name: 'Riff' })).toHaveClass('sr-only');
    // Right after Size, in the card's bar.
    const size = screen.getByRole('group', { name: 'Size' });
    expect(size.nextElementSibling).toContainElement(folded());
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!).header).toBe(false);
  });

  it('picks the small title on a press, with Edit and Expand; Expand brings the head back', () => {
    renderRiff();
    collapse();
    fireEvent.click(folded()!);
    expect(screen.queryByRole('dialog', { name: 'Title and credits' })).toBeNull();
    expect(folded()!.closest('.score-pick')).toHaveClass('score-picked');
    const tools = within(screen.getByTestId('head-tools'));
    expect(tools.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Edit title and credits', 'Expand header']);
    fireEvent.keyDown(folded()!, { key: 'Escape' });
    expect(screen.queryByTestId('head-tools')).toBeNull();
    fireEvent.click(folded()!);
    fireEvent.click(screen.getByRole('button', { name: 'Expand header' }));
    expect(folded()).toBeNull();
    expect(within(head()).getByRole('heading', { level: 1 })).toHaveTextContent('Riff');
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!).header).toBe(true);
  });

  it('comes back unpicked, by Expand or the View option (Jeremy, 2026-11-01)', () => {
    renderRiff();
    collapse();
    fireEvent.click(folded()!);
    fireEvent.click(screen.getByRole('button', { name: 'Expand header' }));
    expect(pick()).not.toHaveClass('score-picked');
    expect(screen.queryByTestId('head-tools')).toBeNull();
    collapse();
    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'View options' })).getByRole('switch', { name: 'Arrangement header' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(pick()).not.toHaveClass('score-picked');
    expect(screen.queryByTestId('head-tools')).toBeNull();
    // Nor is the small title picked when it comes back.
    collapse();
    expect(folded()!.closest('.score-pick')).not.toHaveClass('score-picked');
  });

  it('opens the panel from the small title on a double-click or Edit', () => {
    renderRiff();
    collapse();
    fireEvent.doubleClick(folded()!);
    expect(within(screen.getByRole('dialog', { name: 'Title and credits' })).getByLabelText('Title')).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' });
    fireEvent.click(folded()!);
    fireEvent.click(screen.getByRole('button', { name: 'Edit title and credits' }));
    expect(screen.getByRole('dialog', { name: 'Title and credits' })).toBeInTheDocument();
  });

  it('is the View options\' "Arrangement header" switch, shown in Notation only', () => {
    renderRiff();
    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    const toggle = within(screen.getByRole('dialog', { name: 'View options' })).getByRole('switch', { name: 'Arrangement header' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(folded()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    // Not over the text views.
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(folded()).toBeNull();
  });

  it('is in Settings › Tab › Notation, the same saved value', () => {
    renderRiff();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = within(screen.getByRole('dialog', { name: 'Settings' }));
    fireEvent.click(settings.getByRole('treeitem', { name: 'Notation' }));
    const box = settings.getByRole('checkbox', { name: 'Arrangement header' });
    expect(box).toBeChecked();
    fireEvent.click(box);
    fireEvent.click(settings.getByRole('button', { name: 'OK' }));
    expect(folded()).toBeInTheDocument();
  });
});

describe('the tuning, picked and collapsed (issue #296)', () => {
  const group = () => within(head()).getByRole('group', { name: 'Tuning' });
  const tuningButton = () => within(group()).getAllByRole('button')[0];
  const tools = () => within(screen.getByTestId('head-tools')).getAllByRole('button').map(b => b.getAttribute('aria-label'));
  const pick = () => group().querySelector('.score-pick')!;
  async function renderTunedDown() {
    renderAt('#example=tuned-down');
    await waitFor(() => expect(group()).toHaveTextContent('Tune down 1/2 step'), SLOW);
  }
  function collapse() {
    fireEvent.click(tuningButton());
    fireEvent.click(screen.getByRole('button', { name: 'Collapse tuning' }));
  }

  it('picks the tuning on a press, with Edit and Collapse beside it, and opens nothing', async () => {
    await renderTunedDown();
    fireEvent.click(tuningButton());
    expect(screen.queryByRole('dialog', { name: 'Tuning' })).toBeNull();
    expect(pick()).toHaveClass('score-picked');
    expect(tuningButton()).toHaveAttribute('aria-pressed', 'true');
    expect(tools()).toEqual(['Edit tuning', 'Collapse tuning']);
  });

  it('opens the panel on Edit, Enter or a double-click, and leaves nothing picked', async () => {
    await renderTunedDown();
    fireEvent.click(tuningButton());
    fireEvent.click(screen.getByRole('button', { name: 'Edit tuning' }));
    expect(screen.getByRole('dialog', { name: 'Tuning' })).toBeInTheDocument();
    expect(pick()).not.toHaveClass('score-picked');
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(tuningButton());
    fireEvent.keyDown(tuningButton(), { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: 'Tuning' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Tuning' })).toBeNull();
    fireEvent.doubleClick(tuningButton());
    expect(screen.getByRole('dialog', { name: 'Tuning' })).toBeInTheDocument();
  });

  it('lets the pick go on Esc or when the focus leaves it', async () => {
    await renderTunedDown();
    fireEvent.click(tuningButton());
    fireEvent.keyDown(tuningButton(), { key: 'Escape' });
    expect(screen.queryByTestId('head-tools')).toBeNull();
    fireEvent.click(tuningButton());
    fireEvent.blur(tuningButton(), { relatedTarget: document.body });
    expect(screen.queryByTestId('head-tools')).toBeNull();
  });

  it('collapses to the name alone, unpicked, saved as the Tuning details view option', async () => {
    await renderTunedDown();
    collapse();
    expect(group()).toHaveTextContent(/^Tune down 1\/2 step$/);
    expect(within(group()).queryByLabelText('string 1')).toBeNull();
    expect(pick()).not.toHaveClass('score-picked');
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!).tuningDetails).toBe(false);
    // The header is its own: still shown.
    expect(within(head()).getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('picks the collapsed name, with Edit and Expand; Expand brings the strings back unpicked', async () => {
    await renderTunedDown();
    collapse();
    fireEvent.click(tuningButton());
    expect(pick()).toHaveClass('score-picked');
    expect(tools()).toEqual(['Edit tuning', 'Expand tuning']);
    fireEvent.click(screen.getByRole('button', { name: 'Expand tuning' }));
    expect(within(group()).getByLabelText('string 6').parentElement).toHaveTextContent('6 = E♭');
    expect(pick()).not.toHaveClass('score-picked');
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!).tuningDetails).toBe(true);
  });

  it('opens the panel from the collapsed name on a double-click', async () => {
    await renderTunedDown();
    collapse();
    fireEvent.doubleClick(tuningButton());
    expect(screen.getByRole('dialog', { name: 'Tuning' })).toBeInTheDocument();
  });

  it('offers no Collapse for standard tuning or a tuning of its own', async () => {
    renderAt();
    fireEvent.click(tuningButton());
    expect(tools()).toEqual(['Edit tuning']);
    fireEvent.keyDown(tuningButton(), { key: 'Escape' });
    // The high e down to D: a tuning with no name, so nothing to fold it to.
    fireEvent.doubleClick(tuningButton());
    const panel = screen.getByRole('dialog', { name: 'Tuning' });
    fireEvent.click(within(panel).getByRole('button', { name: 'String 1: E' }));
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'String 1' })).getByRole('radio', { name: 'D' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(tuningButton());
    expect(tools()).toEqual(['Edit tuning']);
  });

  it('is the View options\' "Tuning details" switch and in Settings › Tab › Notation', async () => {
    await renderTunedDown();
    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    const toggle = within(screen.getByRole('dialog', { name: 'View options' })).getByRole('switch', { name: 'Tuning details' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(group()).toHaveTextContent(/^Tune down 1\/2 step$/);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = within(screen.getByRole('dialog', { name: 'Settings' }));
    fireEvent.click(settings.getByRole('treeitem', { name: 'Notation' }));
    const box = settings.getByRole('checkbox', { name: 'Tuning details' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    fireEvent.click(settings.getByRole('button', { name: 'OK' }));
    expect(within(group()).getByLabelText('string 1')).toBeInTheDocument();
  });

  it('prints the image as shown: the name alone when collapsed', () => {
    const clip = { ...emptyPart(), name: 'Riff', tuning: ['D#', 'G#', 'C#', 'F#', 'A#', 'D#'] };
    const style = parseTabExportStyle(null);
    const full = tabSvg(clip, style, 'Riff');
    expect(full).toContain('Tune down 1/2 step');
    expect(full).toContain('= E♭');
    const folded = tabSvg(clip, style, 'Riff', 'tab', { ...DEFAULT_VIEW, tuningDetails: false });
    expect(folded).toContain('Tune down 1/2 step');
    expect(folded).not.toContain('= E♭');
  });
});
