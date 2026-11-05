/**
 * The stand-in host (`mcp/preview/`). `npm run mcp:preview` serves it at http://localhost:5174;
 * `npm run build` builds it into the site at `/mcp-preview/`, so every deploy (each PR preview too)
 * has one to open with no connector.
 */
import path from 'path';
import { defineConfig } from 'vite';

const repo = path.resolve(import.meta.dirname, '..');

export default defineConfig(({ command }) => ({
  root: path.resolve(import.meta.dirname, 'preview'),
  base: command === 'build' ? '/mcp-preview/' : '/',
  publicDir: false,
  resolve: { alias: { '@': path.resolve(repo, 'src') } },
  server: { port: 5174, strictPort: true },
  // Runs after `next build`, which empties out/ first.
  build: { outDir: path.resolve(repo, 'out', 'mcp-preview'), emptyOutDir: true, chunkSizeWarningLimit: 10_000 },
  logLevel: 'warn',
}));
