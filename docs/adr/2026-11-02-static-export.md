# Static export, no server

Frets is a Next.js static export (`output: 'export'`, built to `out/`)
served by Cloudflare Pages. The app needs no server, and a static site is
free to host with nothing to run. The one exception is the MCP endpoint,
`/mcp`, a Cloudflare Pages Function in `functions/`. A feature that would
need a server means reopening this decision, not adding one quietly.

See `DEPLOYMENT.md`.
