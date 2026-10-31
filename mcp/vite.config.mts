/**
 * Builds the metronome's MCP App (#269) into one self-contained file, `mcp/dist/app.html`: the
 * scripts, CSS and fonts all inlined, since a host's iframe may load nothing from outside.
 */
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const repo = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'app'),
  plugins: [react(), viteSingleFile()],
  publicDir: false,
  resolve: { alias: { '@': path.resolve(repo, 'src') } },
  css: { postcss: repo },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    assetsInlineLimit: Infinity,
    rollupOptions: { input: path.resolve(import.meta.dirname, 'app/app.html') },
  },
  logLevel: 'warn',
});
