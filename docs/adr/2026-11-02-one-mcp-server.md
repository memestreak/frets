# One MCP server for all of Frets

Frets has one MCP server, `frets` (at `/mcp` and over stdio), and every
page adds its tools to it, rather than one server per page. A chat app
adds it once and every new tool arrives with nothing more for the user to
do. It was made general as soon as it was meant to grow beyond the
metronome, so later pages follow a path that already exists.

See `docs/specs/2026-11-01-frets-mcp-server-design.md` and
`src/mcp/README.md`.
