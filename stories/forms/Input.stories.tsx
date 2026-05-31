import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '../../src/components/forms/Input'
import { withTheme } from '../decorators'

const meta: Meta<typeof Input> = {
  title:      'Forms/Input',
  component:  Input,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Input>

export const Default: Story  = { args: { label: 'Email', placeholder: 'you@example.com' } }
export const WithError: Story = { args: { label: 'Email', value: 'bad', error: 'Invalid email address' } }
export const WithHint: Story  = { args: { label: 'Username', hint: 'Lowercase letters and numbers only' } }
export const WithPrefix: Story = { args: { label: 'Amount', prefix: '$', type: 'number' } }
