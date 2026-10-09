import type { Meta, StoryObj } from '@storybook/react'
import { GradientText } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof GradientText> = { title: 'Components/GradientText', component: GradientText, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <GradientText>Make room for possibility.</GradientText> }
