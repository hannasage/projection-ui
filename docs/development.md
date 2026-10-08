# Local development

Fumadocs presents the guides and component contracts.
Storybook supplies their interactive component previews.
Its stories import public package paths.
The build installs a real tarball before it renders the documentation.

## Build the preview

```bash
npm ci
npm run build:docs
```

The static documentation appears in `docs-site/out`.
Serve that directory through a local HTTP server for browser review.
The reader includes local search, plain Markdown, and the component explorer at `/examples/`.
The build supplies `PROJECTION_UI_PACKAGE_DIR` to Storybook.
That directory contains the installed candidate used by the preview.
The Storybook configuration refuses a build without that package directory.

## Start the live preview

```bash
npm run dev
```

The command prepares a packed candidate and starts Storybook on port 6006.
It keeps the temporary package while the preview runs.
Restart the command after a library source change to refresh that candidate.

## Check a change

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:docs
npm run test:storybook
npm run test:docs
npm run test:artifact
```

The package checks use a packed artifact rather than source aliases.
Type checks cover public declarations and documented examples.
Browser checks supplement the package checks for keyboard and accessibility behavior.
The final artifact check repeats consumer checks against the release archive after both documentation builds.
It does not rebuild the library.
Read [the test guide](../tests/README.md) for their actual scope.

## Add documentation

Use synthetic data and public package imports.
Use the decorator in `stories/decorators.tsx` to isolate the existing theme.
Add normal, disabled, error, empty, and loading states where they apply.
Give every icon-only control an accessible name.
Give each chart a text or table equivalent.

Authored MDX guides live in `docs/pages`.
MDX combines Markdown with locally authored React examples.
Use a Canvas block to reference a typed story.
The build transforms those blocks into reader previews and plain text links.
Shared prop contracts live in `docs/component-contracts.json`.
Both the reader and explorer use that file.
Keep it aligned with the actual public types and the component reference.
Do not execute visitor-submitted examples or fetch arbitrary example code.

Make sure that guide links, keyboard focus, reduced motion, and text fit work at 390, 768, and 1440 pixels.
Repeat the review at 200 percent zoom.
Keep private records and credentials out of examples and screenshots.
