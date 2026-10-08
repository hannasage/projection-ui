import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'

const meta: Meta<typeof Skeleton> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/Skeleton', component: Skeleton, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof Skeleton>

export const Default: Story = { render: () => <div role="status" aria-label="Loading example" style={{ display: 'grid', gap: 12 }}><Skeleton height={24} width="65%" /><Skeleton /><Skeleton width="85%" /></div> }
