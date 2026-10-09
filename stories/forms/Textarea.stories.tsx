import type { Meta, StoryObj } from '@storybook/react'
import { Textarea } from '@hannasage/projection-ui/core'
import { withTheme } from '../decorators'

const meta: Meta<typeof Textarea> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },  title: 'Forms/Textarea', component: Textarea, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = { args: { placeholder: 'Describe your example', label: 'Textarea' } }
export const WithHint: Story = { args: { ...Default.args, hint: 'Choose a value for this example.' } }
export const WithError: Story = { args: { ...Default.args, error: 'This field needs a value.' } }
export const Disabled: Story = { args: { ...Default.args, disabled: true } }
