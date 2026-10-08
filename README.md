# Projection UI

React components and shared design values for consumer-themed interfaces.
The default appearance uses a dark palette and a chartreuse accent.
Your application supplies its colors, fonts, and radius through `ThemeProvider`.

```tsx
import { Badge, Button, Card } from '@hannasage/projection-ui/core'

export function ProjectExample() {
  return (
    <Card border="accent">
      <Badge dot={false}>Example project</Badge>
      <h2>Shared components</h2>
      <Button type="button" variant="primary">Explore example</Button>
    </Card>
  )
}
```

This branch prepares the `0.2.0-next.0` candidate.
A candidate receives consumer checks before publication.
The new subpaths below describe that candidate, not the published `0.1.5` package.

## Install the candidate locally

A peer dependency is a package that your application supplies.
The core runtime imports React and React DOM.
The package retains all existing peer requirements.
npm also installs the declared chart, drag, and toast peers, even when you use only `/core`.
Build and pack the candidate from this repository:

```bash
npm ci
npm run build
npm pack
```

In your application, install the generated tarball with its actual file path:

```bash
npm install /path/to/packed-candidate.tgz react@19 react-dom@19
```

For the existing registry release, use its root imports and [0.1.5 documentation](https://github.com/hannasage/projection-ui/tree/main).
The candidate does not promise 1.0 API stability.

## Quick start

Import scoped styles once in your application entry.
A CSS variable is a named value that styles share.
The provider sets those values inside its wrapper.

```tsx
import '@hannasage/projection-ui/styles'
import { Badge, Button, Card, DEFAULT_THEME, ThemeProvider } from '@hannasage/projection-ui/core'

export default function App() {
  return (
    <ThemeProvider theme={DEFAULT_THEME} style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)', padding: 24 }}>
      <Card border="accent">
        <Badge dot={false}>Example project</Badge>
        <h1>Build with shared components.</h1>
        <Button type="button" variant="primary">Explore example</Button>
      </Card>
    </ThemeProvider>
  )
}
```

The package selects a font family but does not bundle or download font files.
Existing `UITheme` objects remain compatible.
Optional body and display font roles fall back to the existing `font` field.

## Choose an entry

| Import | Contents | Runtime peers |
| --- | --- | --- |
| `/core` | Theme, foundations, surfaces, actions, forms, modal, skeleton, table, content primitives | React and React DOM |
| `/charts` | AreaChart, BarChart, LineChart, DonutChart | React, React DOM, Recharts |
| `/sortable` | SortableList, SortableItem, arrayMove | React, React DOM, dnd-kit |
| `/toast` | ToastContainer, useToastStore | React, React DOM, Zustand |
| Root | Combined compatibility entry | All feature peers |

The package declares React and React DOM `>=19.0.0`, Recharts `>=3.0.0`, and Zustand `>=5.0.0`.
The dnd-kit ranges are core `>=6.0.0`, sortable `>=10.0.0`, and utilities `>=3.2.2`.
Declared ranges do not prove compatibility with every later version.
Read [the compatibility guide](docs/compatibility.md) for tested consumers.

## Select styles

`/styles` scopes shared component rules to theme wrappers.
`/reset` supplies explicit page-wide rules.
`/tokens` retains the legacy global rules for existing consumers.
Read [the migration guide](docs/pages/Migration.mdx) before changing an existing stylesheet import.

## Components

| Group | Exports |
| --- | --- |
| Foundations | ThemeProvider, DEFAULT_THEME, UI_FOUNDATIONS, RADIUS_SCALE |
| Surfaces and actions | Card, Badge, Button, ButtonGroup, LinkButton |
| Content | Container, Stack, Prose, Separator, VisuallyHidden |
| Forms | Input, Select, Textarea, Toggle, Slider |
| Feedback | Modal, Skeleton, ToastContainer, useToastStore |
| Data | DataTable |
| Sorting | SortableList, SortableItem, arrayMove |
| Charts | AreaChart, BarChart, LineChart, DonutChart |

The package exports component prop types and `UITheme`.
`Toast` is a data type, not a React component.
Application routes, business data, and 3D scenes belong in consuming applications.

## Read and try the guides

```bash
npm run build:storybook
```

The command builds the docs from an installed packed candidate.
The static site appears in `storybook-static`.
The guides cover installation, themes, tokens, accessibility, migration, releases, and community.
Every public component has a preview.
No deployed documentation URL is declared yet.

Read [the component reference](docs/components.md), [theme guide](docs/theming.md), and [development guide](docs/development.md).
Read [the release contract](docs/releases.md) before publication.

## Contribute and give feedback

Use [Issues](https://github.com/hannasage/projection-ui/issues) for defects and bounded requests.
Use [Discussions](https://github.com/hannasage/projection-ui/discussions) for questions, examples, and design feedback.
Share example needs in [the examples discussion](https://github.com/hannasage/projection-ui/discussions/5).
Share upgrade constraints in [the preservation discussion](https://github.com/hannasage/projection-ui/discussions/6).
Read [CONTRIBUTING.md](CONTRIBUTING.md), [FEEDBACK.md](FEEDBACK.md), and [SECURITY.md](SECURITY.md) for each report path.
No response deadline is promised.

## License

[MIT](LICENSE).
