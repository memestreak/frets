/**
 * The app side of every Frets MCP App: its name for the host, and the bridge to the host's
 * messages, outside React. A page's app calls `listenToHost` once, from an effect.
 */
import { applyDocumentTheme, type App, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';

/** What an app tells the host it is, e.g. `appInfo('tuner')` → "Frets tuner". */
export function appInfo(page: string) {
  return { name: `Frets ${page}`, version: '1.0.0' };
}

/** Takes the host's light or dark theme, when the host says which. */
export function followHostTheme(ctx: McpUiHostContext | undefined): void {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
}

/** What the app does with the host's messages. Only teardown is required. */
export interface HostHandlers {
  /** The tool's input, as soon as the host sends it (before the server has checked it). */
  input?: (args: Record<string, unknown>) => void;
  /** The tool result's `structuredContent`. */
  result?: (structuredContent: unknown) => void;
  /** The handshake is done: from now on the app may send the host messages. */
  connected?: () => void;
  /** The host takes the app away: let the audio or the mic go. */
  teardown: () => void;
}

/**
 * Connects to the host, follows its theme, and passes its messages to `on`. The returned
 * function stops listening; after it, `connected` is not called even if the handshake ends late.
 */
export function listenToHost(app: App, on: HostHandlers): () => void {
  const input = ({ arguments: args }: { arguments?: Record<string, unknown> }) => on.input?.(args ?? {});
  const result = ({ structuredContent }: { structuredContent?: unknown }) => on.result?.(structuredContent);
  app.addEventListener('toolinput', input);
  app.addEventListener('toolresult', result);
  app.addEventListener('hostcontextchanged', followHostTheme);
  app.onteardown = () => {
    on.teardown();
    return {};
  };

  let live = true;
  void app.connect().then(() => {
    if (!live) return;
    followHostTheme(app.getHostContext());
    on.connected?.();
  });

  return () => {
    live = false;
    app.removeEventListener('toolinput', input);
    app.removeEventListener('toolresult', result);
    app.removeEventListener('hostcontextchanged', followHostTheme);
    app.onteardown = undefined;
  };
}
