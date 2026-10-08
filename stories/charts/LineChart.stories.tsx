import type { Meta, StoryObj } from '@storybook/react'
import { LineChart } from '@hannasage/projection-ui/charts'
import { withTheme } from '../decorators'

const meta: Meta<typeof LineChart> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/charts`. This entry requires React and React DOM, and Recharts. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },  title: 'Charts/LineChart', component: LineChart, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof LineChart>

const data = [{ label: 'First', value: 2 }, { label: 'Second', value: 3 }, { label: 'Third', value: 1 }]
export const Default: Story = { render: () => <><LineChart data={data} xKey="label" title="Synthetic example values" series={[{ key: 'value', label: 'Value', color: 'var(--ui-primary)' }]} /><table tabIndex={0}><caption>Example values</caption><thead><tr><th scope="col">Label</th><th scope="col">Value</th></tr></thead><tbody>{data.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table></> }
export const Empty: Story = { args: { data: [], xKey: 'label', series: [{ key: 'value', color: 'var(--ui-primary)' }], title: 'No values yet' } }
