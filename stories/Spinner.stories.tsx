import type { Meta, StoryObj } from '@storybook/react'
import { Spinner } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Spinner> = { title: 'Components/Spinner', component: Spinner, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Spinner label="Loading preview" /> }
