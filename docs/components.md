# Component reference

The 0.2 candidate retains the combined `@hannasage/projection-ui` import.
Use `/core`, `/charts`, `/sortable`, or `/toast` to isolate features.
Import `/styles` once for scoped component rules.
Keep `/tokens` when an existing application needs its legacy global rules.
The public export list is in [src/components/index.ts](../src/components/index.ts).

## Surfaces and actions

| Component | Required props | Options and defaults |
| --- | --- | --- |
| `ThemeProvider` | `theme`, `children` | `as="div"`, `className`, `style` |
| `Card` | `children` | `padding="md"`, `border="default"`, `as="div"`, `className`, `style` |
| `Badge` | `children` | `dot=true`, `filled=false`, `dotColor`, `className`, `style` |
| `Button` | None | Native button props, `variant="secondary"`, `size="md"`, `block=false` |
| `ButtonGroup` | `options`, `value`, `onChange` | `variant="chip"`, `size="md"`, `deselectable=false`, `block=false`, `className`, `style` |

Card padding values are `none`, `sm`, `md`, and `lg`.
Its border values are `default`, `subtle`, `accent`, and `none`.
Button variants are `primary`, `secondary`, `ghost`, `danger`, and `icon`.
Button sizes are `sm`, `md`, and `lg`.
An icon-only button needs an accessible name, such as `aria-label`.
Set `type="button"` for a button that must not submit its enclosing form.

ButtonGroup options contain `value`, `label`, and optional `title` and `disabled` fields.
The selected `value` can be `null`.
If `deselectable` is true, clicking the selected option calls `onChange` with an empty string.
Give the group a visible name through `aria-label`.
Arrow keys move the selected radio choice and skip disabled options.
Use it as a selection control, not as an accessible tab system.

```tsx
import { Badge, Button, Card } from '@hannasage/projection-ui'

export function ProjectSummary() {
  return (
    <Card padding="lg" border="accent" as="article">
      <Badge dot={false}>Example project</Badge>
      <h2>Shared components</h2>
      <Button type="button" variant="primary" onClick={() => console.log('Selected')}>
        Select
      </Button>
    </Card>
  )
}
```

## Forms

| Component | Required props | Other props |
| --- | --- | --- |
| `Input` | None | Native input props, `label`, `error`, `hint`, `prefix`, `suffix`, `containerStyle` |
| `Select` | `options` | Native select props, `label`, `error`, `hint`, `placeholder`, `containerStyle` |
| `Textarea` | None | Native textarea props, `label`, `error`, `hint`, `containerStyle` |
| `Toggle` | `checked`, `onChange` | `label`, `hint`, `disabled=false`, `size="md"`, `className`, `style` |
| `Slider` | `value`, `onChange` | `min=0`, `max=100`, `step=1`, `label`, `aria-label`, `valueFormat`, `hint`, `disabled=false`, `className`, `style` |

Select options contain `value`, `label`, and optional `disabled` fields.
Toggle and Slider report their new value directly through `onChange`.
Input, Select, and Textarea use native change events.
Use distinct explicit IDs if a page repeats a field label.
Keep Slider `max` greater than `min` and its value within that range.

```tsx
import { useState } from 'react'
import { Input, Select, Slider, Textarea, Toggle } from '@hannasage/projection-ui'

export function Preferences() {
  const [enabled, setEnabled] = useState(false)
  const [level, setLevel] = useState(50)
  return (
    <form>
      <Input id="example-name" label="Name" name="name" autoComplete="name" />
      <Select
        id="example-layout"
        label="Layout"
        defaultValue="compact"
        options={[{ value: 'compact', label: 'Compact' }, { value: 'wide', label: 'Wide' }]}
      />
      <Textarea id="example-notes" label="Notes" name="notes" />
      <Toggle checked={enabled} onChange={setEnabled} label="Enable previews" />
      <Slider value={level} onChange={setLevel} label="Preview level" min={0} max={100} />
    </form>
  )
}
```

## Feedback

| Component or helper | Contract |
| --- | --- |
| `Modal` | Requires `open`, `title`, `children`, and `onDismiss`; accepts `actions`, `maxWidth=440`, and `className` |
| `Skeleton` | Accepts `width="100%"`, `height=16`, `borderRadius`, `className`, and `style` |
| `ToastContainer` | Takes no props and renders items from `useToastStore` |
| `useToastStore` | Exposes `toasts`, `push(message, variant?)`, and `dismiss(id)` |

Modal actions contain a `label` and optional `onClick`, `href`, `target`, `variant`, `ariaLabel`, and `disabled` fields.
Action variants are `primary`, `secondary`, and `danger`.
Disabled actions do not activate, including actions with an `href`.
Modal closes on Escape and backdrop click.
It moves focus into the dialog, contains Tab movement, and returns focus to the opener.

Toast variants are `info`, `success`, `warning`, and `danger`.
The default variant is `info`. The store removes a toast after 4000 milliseconds.
Mount one ToastContainer inside the theme scope that must style it.

```tsx
import { Button, ToastContainer, useToastStore } from '@hannasage/projection-ui'

export function SaveExample() {
  const push = useToastStore(state => state.push)
  return (
    <>
      <Button type="button" onClick={() => push('Example saved', 'success')}>Save</Button>
      <ToastContainer />
    </>
  )
}
```

## Data table

DataTable requires `columns`, `data`, and `rowKey`.
A column requires `key`, `header`, and `cell(row, index)`.
It accepts `sortable`, `width`, and `align` values of `left`, `right`, or `center`.
The table also accepts `loading=false`, `emptyState`, `className`, and `onRowClick`.

Sorting changes row order and updates the accessible sort state.
Use `sortValue(row)` for a derived value or `compare(a, b)` for a custom comparison.
Give the table an `aria-label`.
Rows with `onRowClick` also respond to keyboard activation.

```tsx
import { DataTable } from '@hannasage/projection-ui'
import type { Column } from '@hannasage/projection-ui'

type ExampleRow = { id: string; title: string }
const columns: Column<ExampleRow>[] = [
  { key: 'title', header: 'Project', cell: row => row.title },
]
const rows: ExampleRow[] = [{ id: 'example-1', title: 'Example project' }]

export function ProjectTable() {
  return <DataTable columns={columns} data={rows} rowKey={row => row.id} />
}
```

## Drag and drop

SortableList requires items with string IDs, an `onReorder` callback, and a child render function.
SortableItem requires `id` and a child render function that receives `dragHandleProps` and `isDragging`.
Both components accept `className` and `style`.
The package exports dnd-kit's `arrayMove` helper.
The list supports pointer and keyboard movement.
Focus a handle, press Space, use arrow keys, then press Space to drop.
Press Escape to cancel.

```tsx
import { useState } from 'react'
import { SortableItem, SortableList } from '@hannasage/projection-ui'

export function ReorderExample() {
  const [items, setItems] = useState([{ id: 'first', title: 'First' }, { id: 'second', title: 'Second' }])
  return (
    <SortableList items={items} onReorder={setItems}>
      {item => (
        <SortableItem key={item.id} id={item.id}>
          {({ dragHandleProps }) => (
            <button type="button" {...dragHandleProps}>Move {item.title}</button>
          )}
        </SortableItem>
      )}
    </SortableList>
  )
}
```

## Charts

AreaChart, BarChart, and LineChart require `data`, `series`, and `xKey`.
Each series contains `key`, `color`, and an optional `label`.
`DEFAULT_CHART_COLORS` supplies six reusable colors, led by the active theme’s primary color.
Use a palette value for each required `color` field. Nonempty custom colors stay unchanged.
An empty color string falls back to the matching palette index.
Mouse proximity adds glow to nearby marks. Axes and labels stay sharp.
Touch, pen, reduced motion, and forced colors do not use decorative glow.
These charts accept `height=260`, `title`, `className`, `style`, `xFormatter`, and `yFormatter`.
BarChart does not expose a stacking prop.

DonutChart requires `data` containing `key`, `label`, `value`, and `color` for each slice.
It accepts `height=260`, `innerRadius=60`, `outerRadius=90`, `title`, `centerLabel`, `className`, `style`, and `yFormatter`.
It does not accept the series-chart `series` or `xKey` props.
Give charts a container with usable width and an accessible text equivalent for their data.

```tsx
import { DonutChart, LineChart, DEFAULT_CHART_COLORS } from '@hannasage/projection-ui/charts'

export function ChartExamples() {
  return (
    <>
      <LineChart
        data={[{ label: 'First', value: 2 }, { label: 'Second', value: 3 }]}
        xKey="label"
        series={[{ key: 'value', label: 'Example values', color: DEFAULT_CHART_COLORS[0] }]}
      />
      <DonutChart
        data={[{ key: 'sample', label: 'Sample', value: 5, color: DEFAULT_CHART_COLORS[0] }]}
        centerLabel="5"
      />
    </>
  )
}
```

## Content primitives

These primitives are available from `/core`.
They accept native HTML attributes and consumer-authored content.

| Component | Contract |
| --- | --- |
| `Container` | Optional `as`, `maxWidth="72rem"`, and native HTML attributes |
| `Stack` | Optional `as`, `direction="column"`, `gap`, and native HTML attributes |
| `Prose` | Optional `as` and native HTML attributes; styles authored HTML |
| `LinkButton` | Required `href`; optional Button `variant` and `size`; native anchor attributes |
| `Separator` | Native `hr` attributes |
| `VisuallyHidden` | Native `span` attributes; content remains available to assistive technology |

Use LinkButton for navigation and Button for an action.
Prose does not parse Markdown or sanitize untrusted HTML.
Keep application navigation and page compositions in the consumer.

## Projection glow

ProjectionGlow is a decorative light field available from `/core` and the root entry.
It inherits the theme primary color and stays within its container.
It does not receive children, focus, or input events.

| Prop | Default | Supported values |
| --- | --- | --- |
| `color` | `var(--ui-primary)` | A CSS color |
| `intensity` | `standard` | `standard`, `subtle` |
| `motion` | `none` | `none`, `reveal` |
| `className`, `style` | None | Consumer appearance and dimensions |

Import `/styles` with the core entry to include the effect rules.
The root entry includes the legacy stylesheet with the same scoped effect.
The reveal runs once for 450 milliseconds and uses opacity and scale.
Reduced motion keeps the final still effect.
Forced colors hide the decorative field.
Use a sibling for authored content, with enough contrast against the page background.

```tsx
import { ProjectionGlow } from '@hannasage/projection-ui/core'
import '@hannasage/projection-ui/styles'

export function LightField() {
  return <section style={{ position: 'relative' }}>
    <ProjectionGlow style={{ height: '16rem' }} />
    <h2>Selected experience</h2>
  </section>
}
```
