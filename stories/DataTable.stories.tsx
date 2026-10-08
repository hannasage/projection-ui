import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { DataTable } from '@hannasage/projection-ui/core'
import type { Column } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'

const meta: Meta<typeof DataTable> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/DataTable', component: DataTable, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof DataTable>

type Row = { id: string; title: string; count: number }
const data: Row[] = [{ id: 'c', title: 'Gamma', count: 3 }, { id: 'a', title: 'Alpha', count: 1 }, { id: 'b', title: 'Beta', count: 2 }]
const columns: Column<Row>[] = [
  { key: 'title', header: 'Example', cell: row => row.title, sortable: true, sortValue: row => row.title },
  { key: 'count', header: 'Items', cell: row => row.count, sortable: true, sortValue: row => row.count, align: 'right' },
]
function TableDemo() {
  const [selected, setSelected] = useState('None')
  return <><DataTable aria-label="Example items" columns={columns} data={data} rowKey={row => row.id} onRowClick={row => setSelected(row.title)} /><p role="status">Selected: {selected}</p></>
}
export const Default: Story = { render: () => <TableDemo /> }
export const Empty: Story = { render: () => <DataTable aria-label="Empty example" columns={columns} data={[]} rowKey={row => row.id} emptyState="No examples yet." /> }
export const Loading: Story = { render: () => <DataTable aria-label="Loading example" columns={columns} data={[]} rowKey={row => row.id} loading /> }
