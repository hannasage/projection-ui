# Projection UI

React components and design tokens for interfaces that share a visual system.
Projection UI starts with a dark palette. Your application supplies its colors, font, and radius through `ThemeProvider`.

```tsx
import { Badge, Button, Card } from '@hannasage/projection-ui'

<Card border="accent">
  <Badge>Selected work</Badge>
  <h2>A clear interface starts with a shared language.</h2>
  <Button type="button" variant="primary">Explore</Button>
</Card>
```

## Install

Peer dependencies are packages that your application supplies.
The package declares these ranges:

| Package | Range |
| --- | --- |
| `react`, `react-dom` | `>=19.0.0` |
| `recharts` | `>=3.0.0` |
| `zustand` | `>=5.0.0` |
| `@dnd-kit/core` | `>=6.0.0` |
| `@dnd-kit/sortable` | `>=10.0.0` |
| `@dnd-kit/utilities` | `>=3.2.2` |

```bash
npm install @hannasage/projection-ui react@19 react-dom@19 recharts@3 zustand@5 @dnd-kit/core@6 @dnd-kit/sortable@10 @dnd-kit/utilities@3
```

These are declared ranges, not a tested compatibility matrix.
The root entry imports the chart, drag, and toast packages even when you use only a basic component.

## Quick start

Import the token stylesheet once in your application entry.
A token is a named value that components share.

```tsx
import '@hannasage/projection-ui/tokens'
import { Badge, Button, Card, ThemeProvider } from '@hannasage/projection-ui'
import type { UITheme } from '@hannasage/projection-ui'

const theme: UITheme = {
  bg: '#07090C',
  surface: '#0D1117',
  border: '#1B2535',
  text: '#DDE3EE',
  muted: '#8396AB',
  primary: '#C9F53A',
  primaryFg: '#07090C',
  danger: '#FF5252',
  font: "'IBM Plex Mono', monospace",
  radius: 'soft',
}

export default function App() {
  return (
    <ThemeProvider
      theme={theme}
      style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)', padding: 24 }}
    >
      <Card border="accent">
        <Badge>Selected work</Badge>
        <h1>Build with a shared visual system.</h1>
        <Button type="button" variant="primary" onClick={() => console.log('Explore')}>
          Explore
        </Button>
      </Card>
    </ThemeProvider>
  )
}
```

The font value selects a font family. The package does not download or bundle that font.
`ThemeProvider` sets CSS variables on its element. Pass a new theme object to change those values.

## Components

| Group | Exports |
| --- | --- |
| Theme and surfaces | `ThemeProvider`, `Card`, `Badge` |
| Actions | `Button`, `ButtonGroup` |
| Forms | `Input`, `Select`, `Textarea`, `Toggle`, `Slider` |
| Feedback | `Modal`, `Skeleton`, `ToastContainer` |
| Data | `DataTable` |
| Drag and drop | `SortableList`, `SortableItem` |
| Charts | `AreaChart`, `BarChart`, `LineChart`, `DonutChart` |

The package also exports `useToastStore`, `arrayMove`, `RADIUS_SCALE`, `UITheme`, and component prop types.
`Toast` is a data type, not an exported React component.

## Read the guides

- [Component APIs and examples](docs/components.md)
- [Themes and CSS tokens](docs/theming.md)
- [Package compatibility and accessibility](docs/compatibility.md)
- [Local component previews](docs/development.md)
- [Release requirements](docs/releases.md)
- [Documentation site specification](docs/site-spec.md)

## Check a local change

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

The tests install a packed artifact in a temporary consumer and compile the documented examples.
They check package compatibility, not browser or accessibility behavior.

## Contribute and give feedback

Use [Issues](https://github.com/hannasage/projection-ui/issues) for bugs and feature requests.
Request clearer examples in [the examples discussion](https://github.com/hannasage/projection-ui/discussions/5).
Share compatibility needs in [the preservation discussion](https://github.com/hannasage/projection-ui/discussions/6).
Read [CONTRIBUTING.md](CONTRIBUTING.md) before a code change and [FEEDBACK.md](FEEDBACK.md) before a report.
For a security concern, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE).
