# Documentation site specification

## Purpose

The public documentation must help a developer install Projection UI, understand its visual system, and choose a component with confidence.
It must show the actual package through interactive examples.
It must present reusable library features separately from application-specific scenes.

## Foundation

Use Fumadocs with Next.js for the main reader.
Use the existing Storybook and Vite setup as the component preview engine at `/examples/`.
The public site is [Projection UI documentation](https://projection-ui-docs.vercel.app).
The repository includes stories for every public component and eight authored MDX guides.
Authored guides use MDX, Markdown content that can contain React examples.
The same guides and `docs/component-contracts.json` supply the reader, explorer, and plain Markdown.
The build compiles code examples against one installed release tarball.
No source alias or symlink supplies the package to either surface.

The files below define the local documentation.

| Target file | Responsibility |
| --- | --- |
| `docs-site/app/layout.tsx` | Define the reader, page metadata, and keyboard skip link |
| `docs-site/app/(docs)/docs/[[...slug]]/page.tsx` | Export guide and component routes as static pages |
| `docs-site/components/Document.tsx` | Present shared content, version, navigation, and plain Markdown |
| `docs-site/components/Example.tsx` | Embed a named local packed-package preview |
| `docs-site/components/SearchDialog.tsx` | Search the local static index with a keyboard dialog |
| `docs-site/app/api/search/route.ts` | Export the search data as a static file |
| `docs-site/app/global.css` | Apply the existing dark Projection palette, font roles, focus, and reduced motion |
| `scripts/docs-content.mjs` | Transform the same guides and prop contracts into MDX and Markdown |
| `scripts/build-docs.mjs` | Build the reader and explorer from the same packed release |
| `scripts/test-docs.mjs` | Exercise reader links, navigation, search, keyboard use, and responsive layout |
| `docs/component-contracts.json` | Supply shared required props, options, and defaults |
| `.storybook/main.ts` | Include MDX guides and resolve only installed packed exports |
| `.storybook/preview.ts` | Configure theme controls, preview isolation, responsive views, and reduced motion |
| `.storybook/manager.ts` | Configure the approved public navigation and visual identity |
| `stories/decorators.tsx` | Supply scoped themes and example backgrounds |
| `stories/*.stories.tsx` | Cover every public component, variant, and interaction |
| `stories/forms/*.stories.tsx` | Cover form labels, disabled states, errors, and keyboard use |
| `stories/charts/*.stories.tsx` | Cover each chart's actual API and text equivalents |
| `docs/pages/Introduction.mdx` | Explain purpose, package scope, and available guides |
| `docs/pages/Installation.mdx` | Show tested installation and framework setup |
| `docs/pages/Theming.mdx` | Explain theme scope, fonts, and consumer overrides |
| `docs/pages/Tokens.mdx` | Show approved token values and theme previews |
| `docs/pages/Accessibility.mdx` | State tested behavior and consumer responsibilities |
| `docs/pages/Migration.mdx` | Give exact upgrade steps and compatibility changes |
| `docs/pages/Community.mdx` | Link the contribution, feedback, and security paths |
| `tests/docs-content.test.mjs` | Verify shared guide conversion and complete component coverage |
| `docs-site/tests/output.test.mjs` | Verify reader, plain content, explorer, and packed release metadata |

## Surface contract

Use the approved Projection UI foundations for typography, color, spacing, surfaces, and motion.
Use 16-pixel body text, useful code blocks, and visible keyboard focus.
Keep the reader dark and use the existing chartreuse accent.
Provide dark, light, and custom-theme demonstrations only for palettes that the library or examples actually supply.
Keep each example's theme inside its preview.
The preview must not overwrite the documentation page's theme.

Use synthetic data and licensed assets.
The site must not execute visitor-submitted code or fetch examples from arbitrary URLs.
Use locally authored examples.
The reader serves Syne headings, IBM Plex Sans reading text, and IBM Plex Mono code and labels.
Font assets are bundled by the docs build; the browser does not contact an external font service.
Copyright notices and the full SIL Open Font License texts ship in `docs-site/public/font-licenses/`.
The reader requires no application accounts, tracking, or cookie banner.
Hosted Preview deployments retain the host account protection.
The static export appears in `docs-site/out`.
It includes `/markdown/`, `/llms.txt`, `/llms-full.txt`, and `/release.json`.
The release metadata names the package version and tarball integrity.

## Acceptance tests

- Build the site from a clean install and the packed release candidate.
- Render every public component and its documented variants.
- Compile code examples against the packed package without source aliases.
- Make sure that every API page names its required peers and actual props.
- Make sure that theme switches affect only the intended preview.
- Run keyboard and automated accessibility checks on navigation and examples.
- Make sure that reduced motion disables decorative animation.
- Render at 390, 768, and 1440 CSS pixels with no unintended horizontal overflow.
- At 200 percent zoom, retain readable content and operable controls.
- Make sure that internal links, source links, and installation commands work.
- Search known terms, follow a result, close the dialog, and restore focus.
- Open and close mobile navigation with the keyboard.
- Copy a code example and confirm that its text matches the displayed source.
- Make sure that the public build contains no credentials or private example data.
- Add the docs homepage to package metadata only after the deployed URL works.

Deployment requires maintainer approval.
A local or in-app browser preview supplies the design review surface.
