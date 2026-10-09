import type { Meta, StoryObj } from '@storybook/react'
import { Progress } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Progress> = { title: 'Components/Progress', component: Progress, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Progress label="Upload progress" value={64} /> }
