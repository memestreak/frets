/** The MCP App's entry: one `App` for the host, and the metronome. */
import { App } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { APP_INFO, MetronomeApp } from '@/features/metronome/mcp/MetronomeApp';
import './app.css';

const app = new App(APP_INFO, {}, { autoResize: true });
createRoot(document.getElementById('root')!).render(<MetronomeApp app={app} />);
