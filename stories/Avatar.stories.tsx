import type { Meta, StoryObj } from '@storybook/react'
import { Avatar } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Avatar> = { title: 'Components/Avatar', component: Avatar, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Avatar alt="Alex Rivera" fallback="AR" /> }
