/** Builds the stdio server (`mcp/stdio.ts`) into one file for Node, `mcp/dist/server.mjs`. */
import path from 'path';
import { defineConfig } from 'vite';

const repo = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  publicDir: false,
  resolve: { alias: { '@': path.resolve(repo, 'src') } },
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: path.resolve(import.meta.dirname, 'stdio.ts'),
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'server.mjs', format: 'es' } },
  },
  logLevel: 'warn',
});
