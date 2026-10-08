import type { Meta, StoryObj } from '@storybook/react'
import { Select } from '@hannasage/projection-ui/core'
import { withTheme } from '../decorators'

const meta: Meta<typeof Select> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },  title: 'Forms/Select', component: Select, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = { args: { options: [{ value: 'compact', label: 'Compact' }, { value: 'wide', label: 'Wide' }], defaultValue: 'compact', label: 'Select' } }
export const WithHint: Story = { args: { ...Default.args, hint: 'Choose a value for this example.' } }
export const WithError: Story = { args: { ...Default.args, error: 'This field needs a value.' } }
export const Disabled: Story = { args: { ...Default.args, disabled: true } }
