import type { Meta, StoryObj } from '@storybook/react'
import { Checkbox } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Checkbox> = { title: 'Components/Checkbox', component: Checkbox, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Checkbox label="Email updates" defaultChecked /> }
