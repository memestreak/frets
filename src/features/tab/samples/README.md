# Tab samples

Drop alphaTex (`.atex`) or ASCII tab (`.txt`) files here and they show up
on the Tab page under Examples… → Samples, titled by their `\title` (or
`Title:` line), else by the file name. Open one with
`/tab#example=sample-<file name without extension>`; `hello-sample.atex`
is `/tab#example=sample-hello-sample`.

How they are served: the route `src/app/tab/samples.json/route.ts` reads
this folder and answers `/tab/samples.json`, a list of `{ file, text }`.
`npm run dev` reads the folder on every request, so a new file shows the
next time Examples… opens. `npm run build` writes the list once, as the
static file `out/tab/samples.json`, so the deployed site lists the files
committed here when it was built.

They are for trying things out: unlike `examples.ts`, they are not tests
and may read with warnings. Never commit a whole copyrighted song here;
keep those out of git.
