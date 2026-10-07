# Compatibility and accessibility

## Package entry points

The published package declares these entry points:

| Import | Declared target |
| --- | --- |
| `@hannasage/projection-ui` with ESM | `dist/index.js` |
| `@hannasage/projection-ui` with CommonJS | `dist/index.cjs` |
| TypeScript declarations | `dist/src/index.d.ts` |
| `@hannasage/projection-ui/tokens` | `dist/tokens/theme.css` |

ESM is JavaScript's import and export module format.
CommonJS is the module format that uses `require`.
Use the public import paths instead of paths under `src` or `dist`.
The package marks CSS files as side effects so a bundler can retain them.
If TypeScript rejects the token import with `TS2882`, add an asset declaration to your application:

```ts
declare module '@hannasage/projection-ui/tokens'
```

The token export is a stylesheet, not a typed JavaScript module.

The peer ranges appear in [the README](../README.md#install) and `package.json`.
A declared lower bound does not establish compatibility with every newer major version.
The repository does not publish a tested browser or framework support matrix.
Test the built package in your application before an upgrade.

## Next.js and server rendering

Server rendering creates the initial HTML before browser code runs.
The package includes interactive components that use React hooks and browser APIs.
For an App Router application, import these components through a client component with `'use client'`.
Import the token stylesheet through an application entry that your framework accepts.

The package output does not supply a tested client/server entry-point contract.
Test the client boundary, initial theme, and hydration in your application.
Hydration connects browser interactions to server-rendered HTML.

## Accessibility

ThemeProvider writes values but does not check contrast.
The current repository does not include an automated accessibility test suite.
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

The current Modal closes on Escape and backdrop click but does not trap or restore focus.
SortableList currently configures a pointer sensor without a keyboard sensor.
The current DataTable updates a sort indicator without reordering rows.
These components need application-level review before use in those interactions.
