import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '../src/components/Badge'
import { withTheme } from './decorators'

const meta: Meta<typeof Badge> = {
  title:      'Components/Badge',
  component:  Badge,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story     = { args: { children: 'open source' } }
export const NoDot: Story       = { args: { children: 'archived', dot: false } }
export const Filled: Story      = { args: { children: 'featured', filled: true } }
export const CustomDot: Story   = { args: { children: 'typescript', dotColor: '#5B9CF6' } }
export const Tags: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {['React', 'TypeScript', 'Vite', 'Zustand', 'Recharts'].map(t => (
        <Badge key={t}>{t}</Badge>
      ))}
    </div>
  ),
}
