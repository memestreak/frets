import '@testing-library/jest-dom/vitest';

// Node 25 ships its own (path-less, non-functional) global localStorage that
// shadows jsdom's; replace it with an in-memory Storage.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

if (typeof globalThis.localStorage?.clear !== 'function') {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

// jsdom has no HTMLDialogElement.showModal / show / close; model them with the
// `open` attribute, which jsdom's stylesheet already uses to hide a closed
// dialog.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
if (typeof HTMLDialogElement.prototype.show !== 'function') {
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}

// jsdom has no IntersectionObserver, and alphaTab's stand-in for it (installed when it loads) has no
// disconnect; one that never reports is enough for the playback footer's "stuck" look.
class QuietIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
Object.defineProperty(globalThis, 'IntersectionObserver', { value: QuietIntersectionObserver, configurable: true, writable: true });
