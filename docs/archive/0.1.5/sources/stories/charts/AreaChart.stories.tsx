import type { Meta, StoryObj } from '@storybook/react'
import { AreaChart } from '../../src/components/charts/AreaChart'
import { withTheme } from '../decorators'

const meta: Meta<typeof AreaChart> = {
  title:      'Charts/AreaChart',
  component:  AreaChart,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

const data = Array.from({ length: 24 }, (_, i) => ({
  month:  `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
  planA:  40000 + i * 3200 + Math.sin(i) * 5000,
  planB:  35000 + i * 2100 + Math.cos(i) * 4000,
}))

type Story = StoryObj<typeof AreaChart>

export const SingleSeries: Story = {
  args: {
    data,
    xKey:   'month',
    series: [{ key: 'planA', color: '#C9F53A', label: 'Plan A' }],
    title:  'Projected Liquidity',
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
    title: 'Plan Comparison',
  },
}
