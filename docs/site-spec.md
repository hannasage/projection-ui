# Documentation site specification

## Purpose

The public documentation must help a developer install Projection UI, understand its visual system, and choose a component with confidence.
It must show the actual package through interactive examples.
It must present reusable library features separately from application-specific scenes.

## Foundation

Use the existing Storybook and Vite setup as the component preview engine.
The repository includes stories for every public component and authored MDX guides.
Authored guides use MDX, Markdown content that can contain React examples.
The selected surface extends the existing Storybook shell.
Do not create a second manual prop reference.

The files below define the local documentation.
No deployed site URL is declared yet.

| Target file | Responsibility |
| --- | --- |
| `.storybook/main.ts` | Include MDX guides and the approved docs and accessibility addons |
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
| `docs/pages/Contributing.mdx` | Link the contribution, feedback, and security paths |
| `tests/docs/examples.test.tsx` | Make sure that documented code matches public exports and props |
| `tests/docs/navigation.spec.ts` | Exercise guide links, previews, keyboard use, and responsive navigation |

## Surface contract

Use the approved Projection UI foundations for typography, color, spacing, surfaces, and motion.
Support a compact reading layout, useful code blocks, and visible keyboard focus.
Provide dark, light, and custom-theme demonstrations only for palettes that the library or examples actually supply.
Keep each example's theme inside its preview.
The preview must not overwrite the documentation page's theme.

Use synthetic data and licensed assets.
The site must not execute visitor-submitted code or fetch examples from arbitrary URLs.
Use locally authored examples.
The initial site requires no accounts, tracking, cookie banner, or external font service.

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
- Make sure that the public build contains no credentials or private example data.
- Add the docs homepage to package metadata only after the deployed URL works.

Deployment requires maintainer approval.
A local or in-app browser preview supplies the design review surface.
