# Projection UI

React components and shared design values for consumer-themed interfaces.
Projection is the default dark theme, with a lime to blue-green gradient.
Coastal Day uses pale blue surfaces and bright blue accents.
`PROJECTION_LIGHT_THEME` remains its compatibility alias.
Fernwood retains the green light palette.
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

This branch prepares the unpublished `0.2.0-next.1` alpha.
An alpha is a preview that receives consumer checks before publication.
The preview includes glass surfaces, edge light, soft underglow, gradients, and the shared neon chart palette.
Both core themes offer flat modes that retain their v0.1 palettes.
The new subpaths below describe that candidate, not the published `0.1.5` package.

## Install the candidate locally

In an existing React 19 application, install one Projection UI package.
The library manages its chart, drag, and toast dependencies.
npm downloads them automatically with the package.
React 19 and React DOM 19 stay shared with your application.
They are peer dependencies: packages that your application supplies.
Build and pack the candidate from this repository:

```bash
npm ci
npm run build
npm pack
```

In your application, install the generated tarball with its actual file path:

```bash
npm install /path/to/packed-candidate.tgz
```

For the existing registry release, use its root imports and [0.1.5 documentation on npm](https://www.npmjs.com/package/@hannasage/projection-ui/v/0.1.5).
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

| Import | Contents | Package-managed runtime |
| --- | --- | --- |
| `/core` | Theme, foundations, surfaces, actions, forms, modal, skeleton, table, content primitives | None |
| `/charts` | AreaChart, BarChart, LineChart, DonutChart | Recharts and react-is |
| `/sortable` | SortableList, SortableItem, arrayMove | dnd-kit |
| `/toast` | ToastContainer, useToastStore | Zustand |
| Root | Combined compatibility entry | All feature dependencies |

All entries share the application's React 19 and React DOM 19.
Feature imports keep their JavaScript isolated; installing the package still downloads its runtime dependencies.
You do not install feature packages separately.
Read [the compatibility guide](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/compatibility.md) for tested consumers.

## Select styles

`/styles` scopes shared component rules to theme wrappers.
`/reset` supplies explicit page-wide rules.
`/tokens` retains the legacy global rules for existing consumers.
Read [the migration guide](https://docs.projectionui.dev/docs/migration/) before changing an existing stylesheet import.

## Components

| Group | Exports |
| --- | --- |
| Foundations | ThemeProvider, DEFAULT_THEME, UI_FOUNDATIONS, RADIUS_SCALE, THEME_PRESETS, Projection, Coastal Day, and Fernwood presets |
| Surfaces and actions | Card, Badge, Button, ButtonGroup, LinkButton, ProjectionGlow |
| Content | Container, Stack, Prose, Separator, VisuallyHidden |
| Forms | Input, Select, Textarea, Toggle, Slider |
| Feedback | Modal, Skeleton, ToastContainer, useToastStore |
| Data | DataTable |
| Sorting | SortableList, SortableItem, arrayMove |
| Charts | AreaChart, BarChart, LineChart, DonutChart |
| Materials | Surface, GradientBackground, GradientText |
| Basics | Avatar, Checkbox, RadioGroup, Tabs, Accordion, Alert, Notification, Progress, Spinner, Tooltip, Carousel |

The package exports component prop types and `UITheme`.
`Toast` is a data type, not a React component.
Application routes, business data, and 3D scenes belong in consuming applications.
`ProjectionGlow` adds decorative light behind sibling content.
It inherits the theme accent and stays still by default.
Read [the token guide](https://docs.projectionui.dev/docs/tokens/) for its optional reveal and reduced-motion behavior.

## Read and try the guides

```bash
npm run build:docs
```

The command builds the Fumadocs reader and component explorer from the same installed packed candidate.
The static site appears in `docs-site/out`.
The guides cover installation, themes, tokens, accessibility, migration, releases, and community.
Every public component has a preview.
Read the [documentation](https://docs.projectionui.dev) and use the [component explorer](https://docs.projectionui.dev/examples/) for interactive examples.
Each reader page has a plain Markdown link.
The [paired gallery](https://docs.projectionui.dev/examples/?path=/story/gallery-components--paired) covers the 49 approved categories in both core themes.
It marks application examples as compositions, not separate package exports.
The gallery includes a flat appearance selector.
The [text index](https://docs.projectionui.dev/llms.txt) links all guides and component contracts.

Read [the component reference](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md), [theme guide](https://docs.projectionui.dev/docs/theming/), and [development guide](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/development.md).
Read [the release contract](https://docs.projectionui.dev/docs/releases/) before publication.

## Contribute and give feedback

Use [Issues](https://github.com/hannasage/projection-ui/issues) for defects and bounded requests.
Use [Discussions](https://github.com/hannasage/projection-ui/discussions) for questions, examples, and design feedback.
Share example needs in [the examples discussion](https://github.com/hannasage/projection-ui/discussions/5).
Share upgrade constraints in [the preservation discussion](https://github.com/hannasage/projection-ui/discussions/6).
Read [CONTRIBUTING.md](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/CONTRIBUTING.md), [FEEDBACK.md](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/FEEDBACK.md), and [SECURITY.md](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/SECURITY.md) for each report path.
No response deadline is promised.

## License

[MIT](LICENSE).
