import { act, fireEvent, render, screen } from '@testing-library/react';
import { MockSwitcher } from '@/components/mocks/MockSwitcher';
import { useMock, type Mock } from '@/components/mocks/useMock';

const BOX: Mock = {
  param: 'mock', label: 'Box',
  options: [{ value: 'a', label: 'Outline' }, { value: 'b', label: 'Tint' }],
};
const BLUE: Mock = {
  param: 'blue', label: 'Blue',
  options: [{ value: '1', label: 'Slate' }, { value: '2', label: 'Denim' }],
};

function Page() {
  const box = useMock(BOX);
  const blue = useMock(BLUE);
  return <p data-testid="page">{box} {blue}</p>;
}

function App({ page = true }: { page?: boolean }) {
  return <>{page && <Page />}<MockSwitcher /></>;
}

const switcher = () => screen.queryByRole('complementary', { name: 'Mocks' });
const option = (name: string) => screen.getByRole('button', { name });

afterEach(() => window.history.replaceState(null, '', '/'));

describe('MockSwitcher', () => {
  it('stays hidden when the link names no mock', () => {
    window.history.replaceState(null, '', '/tab?theme=light');
    render(<App />);
    expect(switcher()).toBeNull();
    expect(screen.getByTestId('page')).toHaveTextContent('a 1');
  });

  it('stays hidden on a page with no mocks, whatever the link says', () => {
    window.history.replaceState(null, '', '/tab?mock=b');
    render(<App page={false} />);
    expect(switcher()).toBeNull();
  });

  it('shows every mock of the page once the link names one, with the chosen options pressed', () => {
    window.history.replaceState(null, '', '/tab?mock=b');
    render(<App />);
    expect(switcher()).not.toBeNull();
    expect(screen.getByTestId('page')).toHaveTextContent('b 1');
    expect(option('Tint')).toHaveAttribute('aria-pressed', 'true');
    expect(option('Outline')).toHaveAttribute('aria-pressed', 'false');
    expect(option('Slate')).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the page in place and keeps the rest of the link', () => {
    window.history.replaceState(null, '', '/tab?mock=a#tabz=abc');
    const before = window.history.length;
    render(<App />);
    fireEvent.click(option('Denim'));
    expect(screen.getByTestId('page')).toHaveTextContent('a 2');
    expect(window.location.pathname).toBe('/tab');
    expect(window.location.search).toBe('?mock=a&blue=2');
    expect(window.location.hash).toBe('#tabz=abc');
    expect(window.history.length).toBe(before);
    expect(option('Denim')).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back to the first option for a value it does not know', () => {
    window.history.replaceState(null, '', '/tab?mock=z');
    render(<App />);
    expect(screen.getByTestId('page')).toHaveTextContent('a 1');
    expect(option('Outline')).toHaveAttribute('aria-pressed', 'true');
  });

  it('folds to one line naming the options, and opens again', () => {
    window.history.replaceState(null, '', '/tab?mock=b&blue=2');
    render(<App />);
    const title = screen.getByRole('button', { name: /^Mock/ });
    fireEvent.click(title);
    expect(title).toHaveAttribute('aria-expanded', 'false');
    expect(title).toHaveTextContent('Tint · Denim');
    expect(screen.queryByRole('button', { name: 'Outline' })).toBeNull();
    fireEvent.click(title);
    expect(option('Outline')).toBeInTheDocument();
  });

  it('follows Back and Forward', () => {
    window.history.replaceState(null, '', '/tab?mock=a');
    render(<App />);
    act(() => {
      window.history.replaceState(null, '', '/tab?mock=b');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('page')).toHaveTextContent('b 1');
  });

  it('hides when the page with the mocks goes', () => {
    window.history.replaceState(null, '', '/tab?mock=b');
    const { rerender } = render(<App />);
    rerender(<App page={false} />);
    expect(switcher()).toBeNull();
  });
});
