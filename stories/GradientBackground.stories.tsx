import type { Meta, StoryObj } from '@storybook/react'
import { GradientBackground } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof GradientBackground> = { title: 'Components/GradientBackground', component: GradientBackground, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <GradientBackground variant="horizon" style={{padding:24,minHeight:180}}>Horizon gradient</GradientBackground> }
