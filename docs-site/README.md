# Projection UI documentation

Fumadocs supplies the static reader, navigation, and local search.
Storybook supplies the component explorer at `/examples/`.
The reader and explorer share the guides in `../docs/pages` and prop contracts in `../docs/component-contracts.json`.

## Build and check

Run these commands from the repository root:

```bash
npm ci
npm run build:docs
npm run test:storybook
npm run test:docs
```

The build installs one real Projection UI tarball for both surfaces.
It compiles the README, guide examples, and stories against that package.
It then runs this application's type, lint, output, and build checks.
No source alias or symlink supplies the library.

The output is `docs-site/out`.
It includes guide pages, component contracts, local search data, plain Markdown, a text index, and the interactive explorer.
`release.json` records the package name, version, and tarball integrity.

Generated content and build output stay outside version control.
Do not edit generated pages or the installed candidate.
Change the shared guides, contracts, or typed stories, then rebuild.

## Hosting

Serve `docs-site/out` as static files.
Keep its `/api/search` file and `/examples/` directory available.
The site needs no server runtime, environment secrets, visitor accounts, external search service, or font download.

The landing page lives at [projectionui.dev](https://projectionui.dev/).
The reader lives at [projectionui.dev/docs](https://projectionui.dev/docs/).
The explorer lives at `/examples/` on the same host.
Keep the Vercel Preview deployment available for review.

`public/vercel.json` carries the static deployment configuration.
The build copies it into `out/vercel.json`.
The same deployment serves the landing page at `/` and the reader at `/docs/`.

After the checks pass, deploy the complete `docs-site/out` directory to Vercel.
Keep its `vercel.json`, `/api/search`, `/examples/`, and `/font-licenses/` files.
Make sure that the landing page, reader, and gallery work in Preview before production deployment.
