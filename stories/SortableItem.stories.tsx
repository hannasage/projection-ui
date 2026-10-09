import type { Meta, StoryObj } from '@storybook/react'
import { SortableItem } from '@hannasage/projection-ui/sortable'
import { ReorderDemo } from './examples/SortableExample'
import { withTheme } from './decorators'
const meta: Meta<typeof SortableItem> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/sortable`. This entry requires React and React DOM, and dnd-kit core, sortable, and utilities. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/SortableItem', component: SortableItem, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const WithinList: StoryObj = { render: () => <ReorderDemo /> }
