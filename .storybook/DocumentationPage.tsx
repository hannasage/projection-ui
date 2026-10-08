import { Description, Primary, Stories, Subtitle, Title, useOf } from '@storybook/blocks'

const contracts: Record<string, [string, string]> = {
  ThemeProvider: ['theme, children', 'as="div", className, style'],
  Card: ['children', 'padding="md", border="default", as="div", className, style'],
  Badge: ['children', 'dot=true, filled=false, dotColor, className, style'],
  Button: ['None', 'Native button attributes; variant="secondary", size="md", block=false'],
  ButtonGroup: ['options, value, onChange', 'variant="chip", size="md", deselectable=false, block=false, aria-label'],
  Input: ['None', 'Native input attributes; label, error, hint, prefix, suffix, containerStyle'],
  Select: ['options', 'Native select attributes; label, error, hint, placeholder, containerStyle'],
  Textarea: ['None', 'Native textarea attributes; label, error, hint, containerStyle'],
  Toggle: ['checked, onChange', 'label, hint, disabled=false, size="md", aria-label, className, style'],
  Slider: ['value, onChange', 'min=0, max=100, step=1, label, aria-label, valueFormat, hint, disabled=false'],
  Modal: ['open, title, children, onDismiss', 'actions, maxWidth=440, className'],
  Skeleton: ['None', 'width="100%", height=16, borderRadius, className, style'],
  ToastContainer: ['None', 'Reads useToastStore; mount one container inside a theme scope'],
  DataTable: ['columns, data, rowKey', 'loading=false, emptyState, onRowClick, aria-label, className; column sortValue and compare'],
  SortableList: ['items, onReorder, children render function', 'String item IDs; className, style'],
  SortableItem: ['id, children render function', 'Render function receives dragHandleProps and isDragging; className, style'],
  AreaChart: ['data, series, xKey', 'height=260, title, xFormatter, yFormatter, className, style'],
  BarChart: ['data, series, xKey', 'height=260, title, xFormatter, yFormatter, className, style'],
  LineChart: ['data, series, xKey', 'height=260, title, xFormatter, yFormatter, className, style'],
  DonutChart: ['data with key, label, value, color', 'height=260, innerRadius=60, outerRadius=90, title, centerLabel, yFormatter, className, style'],
  Container: ['None', 'Native HTML attributes; as, maxWidth="72rem"'],
  Stack: ['None', 'Native HTML attributes; as, direction="column", gap'],
  Prose: ['None', 'Native HTML attributes; as; authored HTML content'],
  LinkButton: ['href', 'Native anchor attributes; Button variant and size'],
  Separator: ['None', 'Native hr attributes'],
  VisuallyHidden: ['None', 'Native span attributes'],
}

/** Authored contracts remain available when packed JavaScript has no docgen metadata. */
function ComponentContract() {
  const resolved = useOf('meta', ['meta'])
  const name = resolved.preparedMeta.title.split('/').pop() ?? ''
  const contract = contracts[name]
  if (!contract) return null
  return <section aria-label={`${name} API`}>
    <h2>Component contract</h2>
    <table><thead><tr><th scope="col">Required props</th><th scope="col">Options and defaults</th></tr></thead>
      <tbody><tr><td>{contract[0]}</td><td>{contract[1]}</td></tr></tbody></table>
    <p><a href="https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md">Read the full component reference</a> for value choices and interaction behavior.</p>
  </section>
}

export function DocumentationPage() {
  return <><Title /><Subtitle /><Description /><Primary /><ComponentContract /><Stories /></>
}
