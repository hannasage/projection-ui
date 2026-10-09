# Compatibility and accessibility

## Package entry points

The 0.2 candidate declares these entry points:

| Import | Declared target |
| --- | --- |
| `@hannasage/projection-ui` with ESM | `dist/index.js` |
| `@hannasage/projection-ui` with CommonJS | `dist/index.cjs` |
| TypeScript declarations | `dist/src/index.d.ts` |
| `/core` | `dist/core.js`, `dist/core.cjs`, `dist/src/core.d.ts` |
| `/charts` | `dist/charts.js`, `dist/charts.cjs`, `dist/src/charts.d.ts` |
| `/sortable` | `dist/sortable.js`, `dist/sortable.cjs`, `dist/src/sortable.d.ts` |
| `/toast` | `dist/toast.js`, `dist/toast.cjs`, `dist/src/toast.d.ts` |
| `/foundations` | `dist/foundations.js`, `dist/foundations.cjs`, `dist/src/foundations.d.ts` |
| `/tokens` | `dist/tokens/theme.css` |
| `/styles` | `dist/tokens/scoped.css` |
| `/reset` | `dist/tokens/reset.css` |

ESM is JavaScript's import and export module format.
CommonJS is the module format that uses `require`.
Use the public import paths instead of paths under `src` or `dist`.
The package marks CSS files as side effects so a bundler can retain them.
If TypeScript rejects the token import with `TS2882`, add an asset declaration to your application:

```ts
declare module '@hannasage/projection-ui/tokens'
```

The token export is a stylesheet, not a typed JavaScript module.

Subpaths isolate runtime bundle imports.
npm installs the package-managed chart, drag, and toast dependencies automatically.
React 19 and React DOM 19 remain shared application peers.
The dependency ranges appear in `package.json`.
Declared ranges do not establish compatibility with every newer version.
Consumer fixtures define the versions that receive package checks.
The release notes record passing evidence before publication.
Test the built package in your application before an upgrade.

## Next.js and server rendering

Server rendering creates the initial HTML before browser code runs.
The package includes interactive components that use React hooks and browser APIs.
For an App Router application, import these components through a client component with `'use client'`.
Import the token stylesheet through an application entry that your framework accepts.

The candidate preserves client directives in interactive entry points.
The Next.js fixture exercises server and client boundaries against the packed artifact.
Test the client boundary, initial theme, and hydration in your application.
Hydration connects browser interactions to server-rendered HTML.

## Accessibility

ThemeProvider writes values but does not check contrast.
The Storybook browser checks run axe against rendered examples.
An axe scan finds common accessibility defects automatically.
Do not infer an accessibility guarantee from a component name or its ARIA attributes.
ARIA attributes describe interface semantics for assistive technology.

Before shipping an application:

- Test every interaction with a keyboard.
- Make sure that focus remains visible.
- Give controls a visible label or an accessible name.
- Use a unique explicit `id` for repeated Input, Select, and Textarea labels.
- Test dialog focus placement, confinement, return, and dismissal.
- Provide text or table equivalents for charts.
- Test the reduced-motion preference against animations and transitions.
- Test text and control contrast in every supported palette.

The candidate adds dialog focus containment and return, keyboard sortable movement, and row ordering for table sorts.
Review these interactions in your application after an upgrade.
Custom themes and compositions still need application-level accessibility tests.
