# Built-in arrangements

Every alphaTex (`.atex`) or ASCII tab (`.txt`) file in a folder here is listed
on the Tab page under Arrangements… → Built-in, in a folder named after its
directory (`song_structure` shows as "Song structure"), titled by its
`\title` (or `Title:` line), else by the file name. To add one, add a file;
to add a folder, add a directory. Nothing else lists them.

Open one with `/tab#example=<file name without extension>`
(`articulations/bends.atex` is `/tab#example=bends`), so file names must be
different across all folders. An example opens in place of your own
arrangement and is never saved; Keep a copy makes it one of yours.

Every folder but `samples/` holds tests (`src/__tests__/tab/examples.test.ts`):
each file must read with no warnings and every bar full, and Frets must write
it back exactly as the file has it (with one newline at the end). A feature
Frets learns to draw gets a file here. `samples/` is for trying things out:
its files are not tests and may read with warnings.

How they are served: the route `src/app/tab/builtin.json/route.ts` reads
these folders and answers `/tab/builtin.json`. `npm run dev` reads them on
every request, so a new file shows the next time Arrangements… opens;
`npm run build` writes the list once, as `out/tab/builtin.json`.

Never commit a whole copyrighted song here: excerpts of up to 12 bars only.
