# Local development

Storybook is a local browser preview for components and their states.
The repository already uses Storybook with Vite and the docs addon.

## Open the preview

```bash
npm ci
npm run dev
```

The development command starts Storybook on port 6006.
Use the terminal's local URL to open it.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Storybook preview |
| `npm run build:storybook` | Build the static Storybook site |
| `npm run build` | Build the library package |
| `npm run lint` | Lint `src` |
| `npm run typecheck` | Check the source and Vite configuration projects |
| `npm test` | Build, pack, and test a temporary package consumer |
| `npm run preview` | Start the Vite preview command |

The typecheck command runs `tsconfig.app.json` and `tsconfig.node.json` directly.
It covers library source and Vite configuration.
Story files and the hidden Storybook configuration directory are outside the effective file lists.

The tests use Node's built-in test runner and the existing TypeScript compiler.
They build the library, install its tarball offline in a temporary consumer, and use existing peer packages from the local installation.
They check public ESM and CommonJS imports, package assets, declarations, server rendering, and every TSX example in README.md and docs.
An invalid-prop example must fail compilation so the compiler check cannot pass without reading its input.
The test run removes its temporary consumer and keeps the generated dist output.
Read [the test guide](../tests/README.md) for scope and setup.

## Story coverage

Existing stories cover Button, Badge, Card, Modal, Slider, ButtonGroup, Input, Toggle, AreaChart, and DonutChart.
These story files use the `autodocs` tag to generate component documentation.
The current Storybook configuration does not include an accessibility addon or interaction test runner.

For a new story, use a synthetic example that contains no private application data.
Use the decorator in `stories/decorators.tsx` for the existing theme.
Add states that make the component's behavior clear, including disabled, empty, and error states where relevant.

## Preview a documentation change

Make sure that Markdown links resolve to tracked files or real public pages.
If you change a code example, compare its imports and props with `src/components/index.ts` and the component interfaces.
If you change a package path, inspect the built tarball before documenting it.
