import React from 'react'
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChartTooltip } from './shared'

export interface DonutSlice {
  key:    string
  label:  string
  value:  number
  color:  string
}

export interface DonutChartProps {
  data:        DonutSlice[]
  height?:     number
  innerRadius?: number
  outerRadius?: number
  title?:      string
  /** Renders a center label, e.g. total value */
  centerLabel?: React.ReactNode
  className?:  string
  style?:      React.CSSProperties
  yFormatter?: (value: number) => string
}

export function DonutChart({
  data,
  height       = 260,
  innerRadius  = 60,
  outerRadius  = 90,
  title,
  centerLabel,
  className,
  style,
  yFormatter,
}: DonutChartProps): React.ReactElement {
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      {title && (
        <div style={{ fontSize: 12, color: 'var(--ui-muted)', marginBottom: 10, fontFamily: 'var(--ui-font)' }}>
          {title}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            strokeWidth={0}
          >
            {data.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload as unknown as Array<{ name: string; value: number; color: string }>}
                yFormatter={yFormatter}
              />
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div style={{
          position:        'absolute',
          top:             title ? 'calc(50% + 16px)' : '50%',
          left:            '50%',
          transform:       'translate(-50%, -50%)',
          textAlign:       'center',
          pointerEvents:   'none',
          fontFamily:      'var(--ui-font)',
        }}>
          {centerLabel}
        </div>
      )}
    </div>
  )
}
