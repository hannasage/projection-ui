import type { Meta, StoryObj } from '@storybook/react'
import { DEFAULT_CHART_COLORS, BarChart } from '@hannasage/projection-ui/charts'
import { withTheme } from '../decorators'

const meta: Meta<typeof BarChart> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/charts`. This entry requires React and React DOM, and Recharts. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },  title: 'Charts/BarChart', component: BarChart, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof BarChart>

const data = [{ label: 'First', value: 2 }, { label: 'Second', value: 3 }, { label: 'Third', value: 1 }]
export const Default: Story = { render: () => <><BarChart data={data} xKey="label" title="Synthetic example values" series={[{ key: 'value', label: 'Value', color: DEFAULT_CHART_COLORS[0] }]} /><table tabIndex={0}><caption>Example values</caption><thead><tr><th scope="col">Label</th><th scope="col">Value</th></tr></thead><tbody>{data.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody></table></> }
export const Empty: Story = { args: { data: [], xKey: 'label', series: [{ key: 'value', color: DEFAULT_CHART_COLORS[0] }], title: 'No values yet' } }
