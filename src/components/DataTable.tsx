import React, { useState } from 'react'
import { Skeleton } from './Skeleton'

export type SortDir = 'asc' | 'desc'

export interface Column<T> {
  key:       string
  header:    React.ReactNode
  cell:      (row: T, idx: number) => React.ReactNode
  sortable?: boolean
  /** Defaults to the row property named by key; never sorts rendered HTML. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Overrides value comparison; equal rows retain their input order. */
  compare?: (a: T, b: T) => number
  width?:    string | number
  align?:    'left' | 'right' | 'center'
}

export interface DataTableProps<T> {
  columns:      Column<T>[]
  data:         T[]
  rowKey:       (row: T) => string
  loading?:     boolean
  /** Slot rendered when data is empty and not loading */
  emptyState?:  React.ReactNode
  className?:   string
  onRowClick?:  (row: T) => void
  'aria-label'?: string
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading     = false,
  emptyState,
  className,
  onRowClick,
  'aria-label': ariaLabel,
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const column = columns.find(col => col.key === sortKey)
  const sortedData = column && column.sortable ? data.map((row, index) => ({ row, index })).sort((a, b) => {
    if (column.compare) {
      const compared = column.compare(a.row, b.row)
      return (sortDir === 'asc' ? compared : -compared) || a.index - b.index
    }
    const value = (row: T) => {
      const raw = column.sortValue ? column.sortValue(row) : (row as Record<string, unknown>)[column.key]
      return typeof raw === 'string' || (typeof raw === 'number' && Number.isFinite(raw)) ? raw : null
    }
    const av = value(a.row)
    const bv = value(b.row)
    // Empty values stay last in both directions; no implicit string coercion of objects.
    if (av == null || bv == null) return av == null && bv == null ? a.index - b.index : av == null ? 1 : -1
    const compared = typeof av === 'number' && typeof bv === 'number' ? av - bv
      : String(av).localeCompare(String(bv))
    return (sortDir === 'asc' ? compared : -compared) || a.index - b.index
  }).map(item => item.row) : data

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const thStyle = (col: Column<T>): React.CSSProperties => ({
    padding:       '9px 12px',
    textAlign:     col.align ?? 'left',
    fontSize:      11,
    fontWeight:    500,
    color:         'var(--ui-muted)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    whiteSpace:    'nowrap',
    width:         col.width,
    borderBottom:  '1px solid var(--ui-border)',
    cursor:        col.sortable ? 'pointer' : 'default',
    userSelect:    'none',
    fontFamily:    'var(--ui-font-body, var(--ui-font))',
  })

  const tdStyle = (col: Column<T>): React.CSSProperties => ({
    padding:    '10px 12px',
    textAlign:  col.align ?? 'left',
    fontSize:   13,
    color:      'var(--ui-text)',
    fontFamily: 'var(--ui-font-body, var(--ui-font))',
    borderBottom: '1px solid color-mix(in srgb, var(--ui-border) 50%, transparent)',
    verticalAlign: 'middle',
  })

  return (
    <div
      className={className}
      style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <table aria-label={ariaLabel} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={thStyle(col)}
                scope="col"
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc' ? 'ascending' : 'descending'
                    : undefined
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.sortable ? <button type="button" onClick={() => handleSort(col.key)} style={{ font: 'inherit', color: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>{col.header}</button> : col.header}
                  {col.sortable && (
                    <span aria-hidden="true" style={{ opacity: sortKey === col.key ? 1 : 0.35, fontSize: 10 }}>
                      {sortKey === col.key && sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} style={tdStyle(col)}>
                    <Skeleton height={14} width={col.width ?? '80%'} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding:   '40px 20px',
                  textAlign: 'center',
                  color:     'var(--ui-muted)',
                  fontSize:  13,
                  fontFamily:'var(--ui-font-body, var(--ui-font))',
                }}
              >
                {emptyState ?? 'No data'}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? event => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRowClick(row) }
                } : undefined}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={tdStyle(col)}>
                    {col.cell(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
