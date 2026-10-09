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

## Update the social preview

The landing site, documentation, and Storybook share `docs-site/public/social/projection-ui.png`.
The shared definition lives in `docs-site/lib/social-preview.ts`.
Storybook also serves the same image from its own `/social/` directory.

After a documentation build, serve `docs-site/out` on port 4173:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs-site/out
```

In another terminal, capture the landing components with the fixed preview layout:

```bash
node scripts/render-social-preview.mjs http://127.0.0.1:4173
```

The command writes a 1200 by 630 pixel PNG with the local fonts and dark theme.
Rebuild the documentation to include the updated image.
Run `npm run test:docs` to test the preview tags and image copies.

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
npm run test:storybook-tools
npm run test:docs
npm run test:docs-themes
npm run test:artifact
```

The package checks use a packed artifact rather than source aliases.
Type checks cover public declarations and documented examples.
Browser checks supplement the package checks for keyboard and accessibility behavior.
The final artifact check repeats consumer checks against the release archive after both documentation builds.
It does not rebuild the library.
Read [the test guide](../tests/README.md) for their actual scope.

## Use the explorer tools

Open the component explorer at `/examples/` after the documentation build.
The Theme toolbar changes component previews between the modern and flat core themes.
Reader examples follow the selected light or dark mode.
The paired gallery keeps both themes visible for comparison.

The Docs page lists prop types and defaults.
Open a story in Canvas to change its accepted props through the Controls panel.
The Button stories expose label, variant, size, appearance, disabled, and full-width controls.
Actions shows the native click events from those stories.
Interactions shows the keyboard activation steps and their assertions.
An assertion states the result that a test expects.

The Accessibility panel runs axe against the rendered story.
Automated results do not establish accessibility compliance.
Review keyboard behavior, assistive technology, and custom theme contrast separately.
The viewport toolbar supplies phone, tablet, and desktop sizes.
Measure and Outline expose spacing and element boundaries.

These extensions use Storybook 8.6.18 and remain development dependencies.
They do not add dependencies to an installed Projection UI application.
Read the official [Controls](https://storybook.js.org/docs/8/essentials/controls), [Interactions](https://storybook.js.org/docs/8/essentials/interactions), and [accessibility](https://storybook.js.org/docs/8/writing-tests/accessibility-testing) guides for their interfaces.

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
