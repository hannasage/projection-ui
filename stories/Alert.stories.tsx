import type { Meta, StoryObj } from '@storybook/react'
import { Alert } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Alert> = { title: 'Components/Alert', component: Alert, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Alert tone="success" title="Draft saved">Your local changes are ready.</Alert> }
