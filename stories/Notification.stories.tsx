import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Notification } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Notification> = { title: 'Components/Notification', component: Notification, decorators: [withTheme], tags: ['autodocs'] }
export default meta
function Example() { const [visible,setVisible] = useState(true); return visible ? <Notification title="New review" onDismiss={() => setVisible(false)}>Alex added a comment.</Notification> : <button onClick={() => setVisible(true)}>Show notification</button> }
export const Default: StoryObj = { render: () => <Example /> }
