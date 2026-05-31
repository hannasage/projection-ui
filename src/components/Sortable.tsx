import React from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export { arrayMove }

export interface SortableListProps<T extends { id: string }> {
  items:      T[]
  onReorder:  (items: T[]) => void
  children:   (item: T, index: number) => React.ReactNode
  className?: string
  style?:     React.CSSProperties
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  className,
  style,
}: SortableListProps<T>): React.ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    if (oldIdx !== -1 && newIdx !== -1) onReorder(arrayMove(items, oldIdx, newIdx))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className} style={style}>
          {items.map((item, idx) => children(item, idx))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export interface SortableItemProps {
  id:         string
  children:   (props: { dragHandleProps: React.HTMLAttributes<HTMLElement>; isDragging: boolean }) => React.ReactNode
  className?: string
  style?:     React.CSSProperties
}

export function SortableItem({ id, children, className, style }: SortableItemProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.5 : 1,
        ...style,
      }}
    >
      {children({
        dragHandleProps: {
          ref: setActivatorNodeRef,
          ...attributes,
          ...listeners,
        } as React.HTMLAttributes<HTMLElement>,
        isDragging,
      })}
    </div>
  )
}
