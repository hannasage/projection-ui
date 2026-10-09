import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '@hannasage/projection-ui/core'
import { withTheme } from '../decorators'

const meta: Meta<typeof Input> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },
  title:      'Forms/Input',
  component:  Input,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story  = { args: { label: 'Email', placeholder: 'you@example.com' } }
export const WithError: Story = { args: { label: 'Email', defaultValue: 'bad', error: 'Invalid email address' } }
export const WithHint: Story  = { args: { label: 'Username', hint: 'Lowercase letters and numbers only' } }
export const WithPrefix: Story = { args: { label: 'Amount', prefix: '$', type: 'number' } }

export const Disabled: Story = { args: { label: 'Unavailable field', disabled: true, placeholder: 'Unavailable' } }
