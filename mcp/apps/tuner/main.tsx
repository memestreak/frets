/// <reference types="vite/client" />
/**
 * The tuner's MCP App entry (`mcp/apps/tuner/`): one `App` for the host, and the tuner. The
 * acoustic guitar's recordings are built in, since the host's frame can't fetch them from the site.
 */
import { App } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { setBuiltInRecordings } from '@/components/tuner/reference';
import { sampleUrls } from '@/components/tuner/sounds';
import { APP_INFO, TunerApp } from '@/features/tuner/mcp/TunerApp';
import './app.css';

const recordings = import.meta.glob('../../../public/sounds/acoustic/*.mp3', {
  query: '?inline', import: 'default', eager: true,
}) as Record<string, string>;
/** By the URL the site serves each from: `/sounds/acoustic/E2.mp3`. */
const byUrl = Object.fromEntries(Object.entries(recordings).map(([file, data]) => [file.replace(/^.*\/public/, ''), data]));
const missing = sampleUrls('acoustic').filter(url => !(url in byUrl));
if (missing.length > 0) throw new Error(`Frets tuner: recordings missing from the build: ${missing.join(', ')}`);
setBuiltInRecordings(byUrl);

const app = new App(APP_INFO, {}, { autoResize: true });
createRoot(document.getElementById('root')!).render(<TunerApp app={app} />);
