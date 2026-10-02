# Deployment Guide: Cloudflare Pages

This project is configured for **Static Export** (`output: 'export'` in
`next.config.ts`) and deploys to Cloudflare Pages.

Production: <https://frets-6e8.pages.dev>

## Connecting to Cloudflare Pages

Follow these steps to set up auto-deployment from the GitHub repository.

### GitHub Prerequisites

You'll need to give the Cloudflare Pages GitHub app access to this
repository. This is configured in your GitHub personal settings, under
"Applications" in the left sidebar.

### Cloudflare Steps

Go directly to the Pages git-integration flow:

```
https://dash.cloudflare.com/?to=/:account/pages/new/provider/github
```

`:account` is a placeholder that Cloudflare resolves; paste the URL
as-is. Do **not** start from the **Create application** button -- it now
opens a unified Workers chooser ("Continue with GitHub", "Select a
template", ...), and "Continue with GitHub" there is Workers Builds,
which asks for deploy and preview commands and requires a
`wrangler.jsonc` this project does not have. The Cloudflare docs still
describe a **Pages** tab on that screen; the docs are stale.

From the repository picker:

1. Choose this repository and select **Begin setup**.
2. Fill in the form:

   | Field                  | Value                            |
   | ---------------------- | -------------------------------- |
   | Project name           | becomes the `*.pages.dev` subdomain |
   | Production branch      | `main`                           |
   | Framework preset       | **Next.js (Static HTML Export)** |
   | Build command          | `npx next build`                 |
   | Build output directory | `out`                            |
   | Root directory         | leave blank                      |

   The preset fills in the build command and output directory. Confirm
   they match -- the plain "Next.js" preset configures SSR and fails
   against `output: 'export'`. No environment variables are needed.

3. Select **Save and Deploy**.

## Automatic Builds

Once connected, every push to the `main` branch causes Cloudflare to:

1. Pull the latest code.
2. Run `npm install`.
3. Run the build command, `npx next build` (what `npm run build` runs
   locally).
4. Deploy the contents of the `out` directory to the global edge network.

Pull requests get preview deployments at their own URLs, which repeat the
same build-and-deploy process.

## Project-Specific Notes

- **Routing.** The export produces discrete pages (`index.html`,
  `intervals.html`, `notes.html`) plus `404.html` -- it is not a
  single-page app. Pages detects the `404.html` and serves it for
  unmatched paths automatically.
- **Redirects.** `public/_redirects` sends `/` to `/intervals`. Files in
  `public/` are copied into `out/` at build time, and Pages parses
  `_redirects` rather than serving it as an asset.
- **Commit hash.** `next.config.ts` reads the short commit hash via
  `git rev-parse` and exposes it as `NEXT_PUBLIC_COMMIT_HASH`. This works
  in the Cloudflare build environment because Pages clones the repository.
- **Node version.** `.node-version` pins Node 22. The Pages build image
  reads that file, and so does CI (`node-version-file` in
  `.github/workflows/ci.yml`), so tests and production builds run on the
  same major version. `engines` in `package.json` sets the floor for local
  work (`>=22.13.0`); newer versions are allowed there.

## Local Verification

Verify the build locally with:

```bash
npm run build
```

The static files are generated in the `out/` directory, which is
gitignored.

## Verifying a Deployment

Check the routes against the deployed origin:

```bash
for p in / /intervals /notes /nonexistent-page; do
  printf "%-20s " "$p"
  curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
    "https://frets-6e8.pages.dev$p"
done
```

Expected:

| Route               | Expected                  |
| ------------------- | ------------------------- |
| `/`                 | `302` to `/intervals`     |
| `/intervals`        | `200`                     |
| `/notes`            | `200`                     |
| `/nonexistent-page` | `404` (serves `404.html`) |
