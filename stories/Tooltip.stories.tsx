import type { Meta, StoryObj } from '@storybook/react'
import { Tooltip, LinkButton } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Tooltip> = { title: 'Components/Tooltip', component: Tooltip, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <Tooltip content="Opens the theme guide"><LinkButton href="/docs/theming/">Theme guide</LinkButton></Tooltip> }
