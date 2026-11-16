import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `docs/specs/2026-11-09-tab-chat-prompt-design.md`: the agent guide is fetched once a visit,
// but a failed fetch isn't kept, so the next request tries again.
describe('loadGuide', () => {
  // Each test gets a fresh module, so its cached guide starts empty.
  let loadGuide: () => Promise<string>;
  beforeEach(async () => {
    vi.resetModules();
    ({ loadGuide } = await import('@/features/tab/chat/guide'));
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = (text: string) => new Response(text, { status: 200 });

  it('fetches a good guide once', async () => {
    const fetchGuide = vi.fn(async () => ok('the guide'));
    vi.stubGlobal('fetch', fetchGuide);
    expect(await loadGuide()).toBe('the guide');
    expect(await loadGuide()).toBe('the guide');
    expect(fetchGuide).toHaveBeenCalledTimes(1);
  });

  it('gives "" when the fetch fails, and tries again next time', async () => {
    const fetchGuide = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok('the guide'));
    vi.stubGlobal('fetch', fetchGuide);
    expect(await loadGuide()).toBe('');
    expect(await loadGuide()).toBe('the guide');
    expect(await loadGuide()).toBe('the guide');
    expect(fetchGuide).toHaveBeenCalledTimes(2);
  });

  it('treats a status that is not ok as a failure', async () => {
    const fetchGuide = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(ok('the guide'));
    vi.stubGlobal('fetch', fetchGuide);
    expect(await loadGuide()).toBe('');
    expect(await loadGuide()).toBe('the guide');
  });
});
