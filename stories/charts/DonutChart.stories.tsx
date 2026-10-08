import type { Meta, StoryObj } from '@storybook/react'
import { DEFAULT_CHART_COLORS, DonutChart } from '@hannasage/projection-ui/charts'
import { withTheme } from '../decorators'

const meta: Meta<typeof DonutChart> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/charts`. This entry requires React and React DOM, and Recharts. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },
  title:      'Charts/DonutChart',
  component:  DonutChart,
  render: args => <><DonutChart {...args} /><table tabIndex={0}><caption>Synthetic category values</caption><thead><tr><th scope="col">Category</th><th scope="col">Value</th></tr></thead><tbody>{args.data.map(slice => <tr key={slice.key}><th scope="row">{slice.label}</th><td>{slice.value}</td></tr>)}</tbody></table></>,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

const data = [
  { key: 'advisory',  label: 'Advisory',  value: 4800, color: DEFAULT_CHART_COLORS[0] },
  { key: 'planning',  label: 'Planning',  value: 2400, color: DEFAULT_CHART_COLORS[1] },
  { key: 'coaching',  label: 'Coaching',  value: 1600, color: DEFAULT_CHART_COLORS[2] },
  { key: 'reporting', label: 'Reporting', value: 800,  color: DEFAULT_CHART_COLORS[3] },
]

type Story = StoryObj<typeof DonutChart>

export const Default: Story = {
  args: {
    data,
    title: 'Synthetic category values',
    centerLabel: (
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)' }}>$9,600</div>
        <div style={{ fontSize: 11, color: 'var(--ui-muted)' }}>MRR</div>
      </div>
    ),
  },
}
