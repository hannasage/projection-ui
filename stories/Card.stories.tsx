import type { Meta, StoryObj } from '@storybook/react'
import { Card } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'

const meta: Meta<typeof Card> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },
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
