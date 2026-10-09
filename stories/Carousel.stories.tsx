import type { Meta, StoryObj } from '@storybook/react'
import { Carousel } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Carousel> = { title: 'Components/Carousel', component: Carousel, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Carousel label="Material studies" items={[{id:"one",label:"Glass",content:"Glass study"},{id:"two",label:"Solid",content:"Solid study"}]} /> }
