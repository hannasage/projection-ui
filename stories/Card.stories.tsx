import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Card } from '../src/components/Card'
import { withTheme } from './decorators'

const meta: Meta<typeof Card> = {
  title:      'Components/Card',
  component:  Card,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  args: { children: <p style={{ color: 'var(--ui-text)', margin: 0 }}>Card content goes here.</p> },
}
export const Accent: Story = {
  args: {
    border:   'accent',
    children: <p style={{ color: 'var(--ui-text)', margin: 0 }}>Accent border card.</p>,
  },
}
export const NoPadding: Story = {
  args: {
    padding:  'none',
    children: <p style={{ color: 'var(--ui-text)', margin: 0, padding: 12 }}>No padding card.</p>,
  },
}
