import React from 'react'

export interface SeriesConfig {
  key:    string
  color:  string
  label?: string
}

export interface BaseChartProps {
  data:       Record<string, unknown>[]
  series:     SeriesConfig[]
  xKey:       string
  height?:    number
  title?:     string
  className?: string
  style?:     React.CSSProperties
  xFormatter?:(value: unknown) => string
  yFormatter?:(value: number) => string
}

export function ChartTooltip({
  active,
  payload,
  label,
  xFormatter,
  yFormatter,
}: {
  active?:     boolean
  payload?:    Array<{ name: string; value: number; color: string }>
  label?:      unknown
  xFormatter?: (value: unknown) => string
  yFormatter?: (value: number) => string
}): React.ReactElement | null {
  if (!active || !payload?.length) return null

  return (
    <div style={{
      background:   'var(--ui-surface)',
      border:       '1px solid var(--ui-border)',
      borderRadius: 'var(--ui-radius-md)',
      padding:      '10px 14px',
      fontFamily:   'var(--ui-font)',
      fontSize:     12,
      minWidth:     140,
    }}>
      {label !== undefined && (
        <div style={{ color: 'var(--ui-muted)', marginBottom: 6 }}>
          {xFormatter ? xFormatter(label) : String(label)}
        </div>
      )}
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: 'var(--ui-text)', fontWeight: 500 }}>
            {yFormatter ? yFormatter(p.value) : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export const AXIS_STYLE = {
  fill:       'var(--ui-muted)',
  fontSize:   11,
  fontFamily: 'var(--ui-font)',
} as const
