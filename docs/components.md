# Component reference

Import components and prop types from `@hannasage/projection-ui`.
Import `@hannasage/projection-ui/tokens` once in the application entry.
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
Its current type signature does not describe that empty-string behavior for every narrow string type.
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
A disabled action with an `href` still renders an anchor. Do not use that combination to block navigation.
Modal closes on Escape and backdrop click. It does not trap or restore focus.

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

The current `sortable` behavior changes the header's indicator and ARIA state, but does not reorder data.
Supply data in the intended order and do not rely on its indicator as a sorting control.

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
The current list registers a pointer sensor without a keyboard sensor.

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
These charts accept `height=260`, `title`, `className`, `style`, `xFormatter`, and `yFormatter`.
BarChart does not expose a stacking prop.

DonutChart requires `data` containing `key`, `label`, `value`, and `color` for each slice.
It accepts `height=260`, `innerRadius=60`, `outerRadius=90`, `title`, `centerLabel`, `className`, `style`, and `yFormatter`.
It does not accept the series-chart `series` or `xKey` props.
Give charts a container with usable width and an accessible text equivalent for their data.

```tsx
import { DonutChart, LineChart } from '@hannasage/projection-ui'

export function ChartExamples() {
  return (
    <>
      <LineChart
        data={[{ label: 'First', value: 2 }, { label: 'Second', value: 3 }]}
        xKey="label"
        series={[{ key: 'value', label: 'Example values', color: 'var(--ui-primary)' }]}
      />
      <DonutChart
        data={[{ key: 'sample', label: 'Sample', value: 5, color: 'var(--ui-primary)' }]}
        centerLabel="5"
      />
    </>
  )
}
```
