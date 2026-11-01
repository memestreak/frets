/** The tuner's MCP App entry (`mcp/apps/tuner/`): one `App` for the host, and the tuner. */
import { App } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { APP_INFO, TunerApp } from '@/features/tuner/mcp/TunerApp';
import './app.css';

const app = new App(APP_INFO, {}, { autoResize: true });
createRoot(document.getElementById('root')!).render(<TunerApp app={app} />);
