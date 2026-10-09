import type { Meta, StoryObj } from '@storybook/react'
import { Accordion } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Accordion> = { title: 'Components/Accordion', component: Accordion, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Accordion items={[{value:"details",title:"Project details",content:"A material study using the shared theme."},{value:"review",title:"Review notes",content:"The top edge stays quiet."}]} /> }
