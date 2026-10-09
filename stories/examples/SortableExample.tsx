import { useState } from 'react'
import { SortableList, SortableItem } from '@hannasage/projection-ui/sortable'

export function ReorderDemo() {
  const [items, setItems] = useState([{ id: 'first', title: 'First' }, { id: 'second', title: 'Second' }, { id: 'third', title: 'Third' }])
  return <><p>Focus a handle. Press Space, use the arrow keys, then press Space to drop.</p><SortableList items={items} onReorder={setItems}>
    {item => <SortableItem key={item.id} id={item.id}>{({ dragHandleProps }) => <button type="button" {...dragHandleProps} style={{ display: 'block', width: '100%', padding: 16, marginBottom: 8, background: 'var(--ui-surface)', color: 'var(--ui-text)', border: '1px solid var(--ui-border)' }}>Move {item.title}</button>}</SortableItem>}
  </SortableList><p role="status">Order: {items.map(item => item.title).join(', ')}</p></>
}
