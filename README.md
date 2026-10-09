# Projection UI

<p>
  <a href="https://github.com/hannasage/projection-ui/pull/7"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/status-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/status-dark.svg" alt="Release status: alpha candidate" height="28"></picture></a>
  <a href="https://www.npmjs.com/package/@hannasage/projection-ui"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/npm-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/npm-dark.svg" alt="Published npm releases" height="28"></picture></a>
  <a href="https://github.com/hannasage/projection-ui/actions/workflows/ci.yml"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/build-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/build-dark.svg" alt="Open the current build status on GitHub Actions" height="28"></picture></a>
  <a href="https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/LICENSE"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/license-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/license-dark.svg" alt="License: MIT" height="28"></picture></a>
  <a href="#install-the-candidate-locally"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/react-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/react-dark.svg" alt="Requirements: React and React DOM 19 or newer" height="28"></picture></a>
  <a href="https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/compatibility.md"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/types-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/types-dark.svg" alt="TypeScript declarations included" height="28"></picture></a>
  <a href="#choose-an-entry"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/runtime-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/runtime-dark.svg" alt="The package manages chart, sorting, and toast dependencies" height="28"></picture></a>
  <a href="https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/FEEDBACK.md"><picture><source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/support-light.svg"><img src="https://raw.githubusercontent.com/hannasage/projection-ui/929d22bffe434a3c56e15be20db2ec2e7ff227db/docs/readme-assets/badges/support-dark.svg" alt="Community support through GitHub Issues and Discussions" height="28"></picture></a>
</p>

Yes. Another UI library.
React components, shared themes, and a thing for light.
You still have to build the app.

[Documentation](https://docs.projectionui.dev) · [Component explorer](https://docs.projectionui.dev/examples/) · [Give feedback](https://github.com/hannasage/projection-ui/discussions)

![Glass cards with real buttons: Coastal Day in pale blue on the left, and Projection in dark lime on the right.](https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/materials-paired.png)

`0.2.0-next.2` is an alpha candidate.
An alpha is a preview that receives consumer checks before publication.
The screenshots show real components from the packed library.
The preview adds glass, edge light, underglow, gradients, and a shared chart palette.
The instructions below describe this candidate, not the published `0.1.5` package.

<img src="https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/theme-divider.svg" alt="" width="1200" height="12">

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
Read the [maintenance guide](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/releases.md#maintenance-branches) for the separate 0.1 patch path.
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

![Buttons in Coastal Day and Projection, with add item, disabled reset, and quiet actions.](https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/controls-paired.png)

<img src="https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/theme-divider.svg" alt="" width="1200" height="12">

## Give it your theme

Projection is the default dark theme, with a subtle lime gradient.
Coastal Day uses a soft blue shift on pale surfaces.
Fernwood keeps the green light palette.
`PROJECTION_LIGHT_THEME` remains an alias for Coastal Day.
Your application supplies colors, fonts, and radius through `ThemeProvider`.

```tsx
import { Card, COASTAL_DAY_THEME, ThemeProvider } from '@hannasage/projection-ui/core'

export function LightExample() {
  return (
    <ThemeProvider theme={COASTAL_DAY_THEME}>
      <Card material="glass" edgeLight underglow>
        <h2>Keep the light.</h2>
        <p>Content stays clear. The background gets the blur.</p>
      </Card>
    </ThemeProvider>
  )
}
```

Use `PROJECTION_FLAT_THEME` or `COASTAL_DAY_FLAT_THEME` for the main pair with solid surfaces.
Coastal Day Flat keeps blue accents.
`FERNWOOD_FLAT_THEME` retains the original green light palette.
The [theme guide](https://docs.projectionui.dev/docs/theming/) covers custom values and all presets.

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
Read [the compatibility guide](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/compatibility.md) for tested consumers.

## Add a chart

Import the feature you need.
The package manages Recharts and its other feature dependencies.

![Real bar charts in Coastal Day and Projection, with a text table that gives the same example values.](https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/charts-paired.png)

```tsx
import { BarChart } from '@hannasage/projection-ui/charts'
import { PROJECTION_THEME, ThemeProvider } from '@hannasage/projection-ui/core'

const data = [
  { day: 'Mon', reviews: 4 },
  { day: 'Tue', reviews: 6 },
  { day: 'Wed', reviews: 3 },
]

export function ReviewChart() {
  return (
    <ThemeProvider theme={PROJECTION_THEME}>
      <BarChart
        data={data}
        xKey="day"
        series={[{ key: 'reviews', label: 'Reviews', color: 'var(--ui-primary)' }]}
        title="Example review activity"
        height={220}
      />
    </ThemeProvider>
  )
}
```

These values are example data.
Pair charts with a text summary or table for readers who cannot use the visual.
Read the [accessibility guide](https://docs.projectionui.dev/docs/accessibility/).

<img src="https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/theme-divider.svg" alt="" width="1200" height="12">

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

![A real Projection form with a project input, progress bar, slider, toggle, and gradient save button.](https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/projection-dark.png)

<img src="https://raw.githubusercontent.com/hannasage/projection-ui/d03bbaeb0321b95106207959e19c35e004438ff1/docs/readme-assets/theme-divider.svg" alt="" width="1200" height="12">

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

Read [the component reference](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md), [theme guide](https://docs.projectionui.dev/docs/theming/), and [development guide](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/development.md).
Read [the release contract](https://docs.projectionui.dev/docs/releases/) before publication.

## Contribute and give feedback

Use [Issues](https://github.com/hannasage/projection-ui/issues) for defects and bounded requests.
Use [Discussions](https://github.com/hannasage/projection-ui/discussions) for questions, examples, and design feedback.
Share example needs in [the examples discussion](https://github.com/hannasage/projection-ui/discussions/5).
Share upgrade constraints in [the preservation discussion](https://github.com/hannasage/projection-ui/discussions/6).
Read [CONTRIBUTING.md](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/CONTRIBUTING.md), [FEEDBACK.md](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/FEEDBACK.md), and [SECURITY.md](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/SECURITY.md) for each report path.
No response deadline is promised.

## License

[MIT](LICENSE).
