/// <reference types="vite/client" />
/**
 * The Tab MCP App's entry (`mcp/apps/tab/`): one `App` for the host, and the line. The steel-string
 * guitar's soundfont is built in, since the host's frame can't fetch it from the site.
 */
import { App } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { setBuiltInFonts } from '@/features/tab/playback';
import { APP_INFO, TabApp } from '@/features/tab/mcp/TabApp';
import guitar from '../../../public/soundfont/guitar-iowa.sf3?inline';
import './app.css';

/** A data URL's bytes. */
function bytesOf(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// By the URL the site serves it from, as the Tab page's sounds list names it.
setBuiltInFonts({ '/soundfont/guitar-iowa.sf3': bytesOf(guitar) });

const app = new App(APP_INFO, {}, { autoResize: true });
createRoot(document.getElementById('root')!).render(<TabApp app={app} />);
