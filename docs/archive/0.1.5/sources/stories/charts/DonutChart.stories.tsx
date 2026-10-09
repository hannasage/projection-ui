import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { DonutChart } from '../../src/components/charts/DonutChart'
import { withTheme } from '../decorators'

const meta: Meta<typeof DonutChart> = {
  title:      'Charts/DonutChart',
  component:  DonutChart,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

const data = [
  { key: 'advisory',  label: 'Advisory',  value: 4800, color: '#4A9EFF' },
  { key: 'planning',  label: 'Planning',  value: 2400, color: '#7C6FFF' },
  { key: 'coaching',  label: 'Coaching',  value: 1600, color: '#FF6B6B' },
  { key: 'reporting', label: 'Reporting', value: 800,  color: '#FFB347' },
]

type Story = StoryObj<typeof DonutChart>

export const Default: Story = {
  args: {
    data,
    title: 'MRR by Category',
    centerLabel: (
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)' }}>$9,600</div>
        <div style={{ fontSize: 11, color: 'var(--ui-muted)' }}>MRR</div>
      </div>
    ),
  },
}
