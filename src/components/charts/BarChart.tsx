import React from 'react'
import {
  BarChart as ReBarChart,
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { BaseChartProps } from './shared'
import { ChartTooltip, AXIS_STYLE } from './shared'

export type { BaseChartProps as BarChartProps }

export function BarChart({
  data,
  series,
  xKey,
  height      = 260,
  title,
  className,
  style,
  xFormatter,
  yFormatter,
}: BaseChartProps): React.ReactElement {
  return (
    <div className={className} style={style}>
      {title && (
        <div style={{ fontSize: 12, color: 'var(--ui-muted)', marginBottom: 10, fontFamily: 'var(--ui-font)' }}>
          {title}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 6" stroke="var(--ui-border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={xFormatter ? (v) => xFormatter(v) : undefined}
          />
          <YAxis
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={yFormatter}
          />
          <Tooltip content={<ChartTooltip xFormatter={xFormatter} yFormatter={yFormatter} />} />
          {series.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--ui-font)' }} iconType="square" />
          )}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label ?? s.key}
              fill={s.color}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}
