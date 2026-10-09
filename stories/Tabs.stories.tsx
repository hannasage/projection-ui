import type { Meta, StoryObj } from '@storybook/react'
import { Tabs } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Tabs> = { title: 'Components/Tabs', component: Tabs, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Tabs label="Project sections" items={[{value:"overview",label:"Overview",content:"Ready for review."},{value:"activity",label:"Activity",content:"Draft saved."}]} /> }
