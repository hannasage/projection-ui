# @hannasage/projection-ui

Dark-first React component library with consumer-configurable theming. No hardcoded themes — you define your palette, the library renders it.

## Installation

```bash
npm install @hannasage/projection-ui
```

### Peer dependencies

```bash
npm install react react-dom recharts zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Quick start

### 1. Import the fallback tokens (optional but recommended)

In your entry file (`main.tsx` or `index.tsx`):

```tsx
import '@hannasage/projection-ui/tokens'
```

This loads a set of CSS custom property defaults. If you wrap your app with `ThemeProvider`, these are overridden by your theme — but they act as a safe fallback.

### 2. Define your theme

```ts
import type { UITheme } from '@hannasage/projection-ui'

const myTheme: UITheme = {
  bg:        '#07090C',   // page background
  surface:   '#0D1117',   // card / panel
  border:    '#1B2535',   // borders
  text:      '#DDE3EE',   // primary text
  muted:     '#8396AB',   // secondary text / labels
  primary:   '#C9F53A',   // accent — buttons, focus rings
  primaryFg: '#07090C',   // text on top of primary (e.g. button label)
  danger:    '#FF5252',   // destructive actions
  font:      "'IBM Plex Mono', monospace",
  radius:    'soft',      // 'sharp' | 'soft' | 'rounded'
}
```

**Radius presets:**

| preset | buttons/inputs | cards | pills/toggles |
|---|---|---|---|
| `sharp` | 2px | 4px | 4px (no pill) |
| `soft` | 6px | 10px | 9999px |
| `rounded` | 16px | 24px | 9999px |

### 3. Wrap your app

```tsx
import { ThemeProvider, ToastContainer } from '@hannasage/projection-ui'

export default function App() {
  return (
    <ThemeProvider theme={myTheme}>
      <YourApp />
      <ToastContainer />
    </ThemeProvider>
  )
}
```

Switching themes is instant — pass a new `theme` object and all `--ui-*` CSS variables update automatically.

---

## Component reference

### Layout

| Component | Description |
|---|---|
| `ThemeProvider` | Writes CSS vars from your theme. Wrap your app root. |
| `Card` | Surface container. Props: `padding`, `border`, `as`, `className` |

### Actions

| Component | Description |
|---|---|
| `Button` | Variants: `primary` `secondary` `ghost` `danger`. Sizes: `sm` `md` `lg`. |
| `ButtonGroup` | Segmented control / tab bar. Mutually exclusive options with optional deselect. |

### Forms

| Component | Description |
|---|---|
| `Input` | Text input with label, error, hint, prefix/suffix slots |
| `Select` | Styled native select with chevron |
| `Textarea` | Resizable textarea with label, error, hint |
| `Toggle` | On/off switch. Sizes: `sm` `md` |
| `Slider` | Range input with fill track, value display, and min/max labels |

### Feedback

| Component | Description |
|---|---|
| `Modal` | Accessible dialog. Closes on Escape + backdrop click. |
| `ToastContainer` | Notification portal. Use `useToastStore().push(message, variant)` to trigger. |
| `Skeleton` | Shimmer placeholder. Configurable width, height, borderRadius. |

### Data

| Component | Description |
|---|---|
| `DataTable` | Sortable columns, loading skeletons, empty state slot, row click handler |

### Drag and drop

| Component | Description |
|---|---|
| `SortableList` | Wraps `@dnd-kit` DndContext + SortableContext |
| `SortableItem` | Render-prop item exposing `dragHandleProps` and `isDragging` |

### Charts (Recharts wrappers)

| Component | Description |
|---|---|
| `AreaChart` | Gradient fill area chart |
| `BarChart` | Grouped or stacked bar chart |
| `LineChart` | Multi-series line chart |
| `DonutChart` | Pie/donut with optional center label slot |

All charts accept `data`, `series` (array of `{ key, color, label }`), `xKey`, `height`, `title`, `xFormatter`, `yFormatter`.

---

## Toast usage

```tsx
import { useToastStore } from '@hannasage/projection-ui'

function MyComponent() {
  const toast = useToastStore(s => s.push)

  return (
    <button onClick={() => toast('Saved!', 'success')}>
      Save
    </button>
  )
}
```

Variants: `info` | `success` | `warning` | `danger`

---

## Dynamic theming

ThemeProvider is just a div that writes CSS vars — swapping themes is a single state update:

```tsx
const [theme, setTheme] = useState<UITheme>(darkTheme)

<ThemeProvider theme={theme}>
  <button onClick={() => setTheme(lightTheme)}>Toggle theme</button>
</ThemeProvider>
```

---

## Used in

- **[financial-projections](https://github.com/hannasage/financial-projections)** — personal financial scenario planner (the app this library was extracted from)
- **[sageadvice-crm](https://github.com/hannasage/sageadvice-crm)** — production CRM for a financial advisory practice

---

## License

MIT
