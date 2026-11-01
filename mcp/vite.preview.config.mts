/** `npm run mcp:preview`: serves the stand-in host (`mcp/preview/`) at http://localhost:5174. */
import path from 'path';
import { defineConfig } from 'vite';

const repo = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'preview'),
  publicDir: false,
  resolve: { alias: { '@': path.resolve(repo, 'src') } },
  server: { port: 5174, strictPort: true },
});
