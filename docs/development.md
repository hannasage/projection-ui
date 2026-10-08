# Local development

Storybook previews the components and authored guides.
Its stories import public package paths.
The build installs a real tarball before it renders the documentation.

## Build the preview

```bash
npm ci
npm run build:storybook
```

The static documentation appears in `storybook-static`.
Serve that directory through a local HTTP server for browser review.
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
npm run build:storybook
```

The package checks use a packed artifact rather than source aliases.
Type checks cover public declarations and documented examples.
Browser checks supplement the package checks for keyboard and accessibility behavior.
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
Keep prop contracts with the actual public types and the component reference.
Do not execute visitor-submitted examples or fetch arbitrary example code.

Make sure that guide links, keyboard focus, reduced motion, and text fit work at 390, 768, and 1440 pixels.
Repeat the review at 200 percent zoom.
Keep private records and credentials out of examples and screenshots.
