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

The public site is [Projection UI documentation](https://projection-ui-docs.vercel.app).
