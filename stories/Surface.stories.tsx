import type { Meta, StoryObj } from '@storybook/react'
import { Surface } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Surface> = { title: 'Components/Surface', component: Surface, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Surface material="glass" edgeLight underglow style={{padding:24}}>Glass surface with quiet light</Surface> }
