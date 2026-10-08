import type { Meta, StoryObj } from '@storybook/react'
import { AreaChart } from '@hannasage/projection-ui/charts'
import { withTheme } from '../decorators'

const meta: Meta<typeof AreaChart> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/charts`. This entry requires React and React DOM, and Recharts. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },
  title:      'Charts/AreaChart',
  component:  AreaChart,
  render: args => <><AreaChart {...args} /><table><caption>Synthetic chart values</caption><thead><tr><th scope="col">Label</th>{args.series.map(series => <th key={series.key} scope="col">{series.label ?? series.key}</th>)}</tr></thead><tbody>{args.data.map((row, index) => <tr key={index}><th scope="row">{String(row[args.xKey])}</th>{args.series.map(series => <td key={series.key}>{String(row[series.key])}</td>)}</tr>)}</tbody></table></>,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

const data = Array.from({ length: 24 }, (_, i) => ({
  month:  `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
  planA:  Math.round(40000 + i * 3200 + Math.sin(i) * 5000),
  planB:  Math.round(35000 + i * 2100 + Math.cos(i) * 4000),
}))

type Story = StoryObj<typeof AreaChart>

export const SingleSeries: Story = {
  args: {
    data,
    xKey:   'month',
    series: [{ key: 'planA', color: '#C9F53A', label: 'Plan A' }],
    title:  'Synthetic values',
  },
}

export const MultiSeries: Story = {
  args: {
    data,
    xKey:   'month',
    series: [
      { key: 'planA', color: '#C9F53A', label: 'Plan A' },
      { key: 'planB', color: '#5B9CF6', label: 'Plan B' },
    ],
    title: 'Synthetic series comparison',
  },
}
