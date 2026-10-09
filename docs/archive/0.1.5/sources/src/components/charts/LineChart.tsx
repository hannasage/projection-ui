import React from 'react'
import {
  LineChart as ReLineChart,
  Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { BaseChartProps } from './shared'
import { ChartTooltip, AXIS_STYLE } from './shared'

export type { BaseChartProps as LineChartProps }

export function LineChart({
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
        <ReLineChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--ui-font)' }} iconType="circle" />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  )
}
