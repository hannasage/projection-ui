import { ReorderDemo } from './examples/SortableExample'
import type { Meta, StoryObj } from '@storybook/react'
import { SortableList } from '@hannasage/projection-ui/sortable'
import { withTheme } from './decorators'

const meta: Meta<typeof SortableList> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/sortable`. This entry requires React and React DOM, and dnd-kit core, sortable, and utilities. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/SortableList', component: SortableList, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof SortableList>


export const Default: Story = { render: () => <ReorderDemo /> }
