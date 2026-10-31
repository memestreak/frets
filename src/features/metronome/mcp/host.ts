/**
 * The MCP App's side of the host's messages, outside React: what the app does when the tool's input
 * or result arrives, when the host's theme changes, and when the host takes the app away.
 */
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';

export interface HostHandlers {
  input: (args: Record<string, unknown>) => void;
  result: (structuredContent: unknown) => void;
  context: (ctx: McpUiHostContext) => void;
  teardown: () => void;
}

/** Listens to the host; the returned function stops listening. */
export function listenToHost(app: App, on: HostHandlers): () => void {
  const input = ({ arguments: args }: { arguments?: Record<string, unknown> }) => on.input(args ?? {});
  const result = ({ structuredContent }: { structuredContent?: unknown }) => on.result(structuredContent);
  app.addEventListener('toolinput', input);
  app.addEventListener('toolresult', result);
  app.addEventListener('hostcontextchanged', on.context);
  app.onteardown = () => {
    on.teardown();
    return {};
  };
  return () => {
    app.removeEventListener('toolinput', input);
    app.removeEventListener('toolresult', result);
    app.removeEventListener('hostcontextchanged', on.context);
    app.onteardown = undefined;
  };
}
