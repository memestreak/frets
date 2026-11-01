/**
 * Builds one MCP App, `mcp/apps/<MCP_APP>/`, into one self-contained file, `mcp/dist/<MCP_APP>.html`:
 * the scripts, CSS and fonts all inlined, since a host's iframe may load nothing from outside.
 * `mcp/build.mjs` runs it once per folder in `mcp/apps/`.
 */
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const repo = path.resolve(import.meta.dirname, '..');
const app = process.env.MCP_APP;
if (!app) throw new Error('Set MCP_APP to a folder in mcp/apps/, or run npm run mcp:build.');
const root = path.resolve(import.meta.dirname, 'apps', app);

export default defineConfig({
  root,
  plugins: [react(), viteSingleFile()],
  publicDir: false,
  resolve: { alias: { '@': path.resolve(repo, 'src') } },
  css: { postcss: repo },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    assetsInlineLimit: Infinity,
    rollupOptions: { input: path.resolve(root, `${app}.html`) },
  },
  logLevel: 'warn',
});
