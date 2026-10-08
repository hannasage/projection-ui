import React, { useEffect, useRef, useState } from 'react'

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
          <span style={{ color: 'var(--ui-text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />{p.name}</span>
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


/** The first color follows the active theme. Explicit series and slice colors take precedence. */
export const DEFAULT_CHART_COLORS = [
  'var(--ui-primary)', '#38D9FF', '#B58AFF', '#FF5F8F', '#FFB84D', '#50F5B5',
] as const

export function chartColor(color: string, index: number): string {
  return color.trim() ? color : DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
}

export function chartLegendLabel(value: React.ReactNode): React.ReactElement {
  return <span style={{ color: 'var(--ui-text)' }}>{value}</span>
}

type Point = { x: number; y: number }
type Mark = { geometry: string; points: Point[]; filter: string }
const MARK_SELECTOR = '.recharts-line-curve, .recharts-area-curve, .recharts-area-area, .recharts-bar-rectangle .recharts-rectangle, .recharts-pie-sector .recharts-sector'
const GLOW_RADIUS = 96

function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}

/** Decorative, mouse-only feedback. Work is coalesced into one frame; there is no idle animation. */
export function useChartGlow(): { ref: React.RefObject<HTMLDivElement | null>; motionAllowed: boolean } {
  const ref = useRef<HTMLDivElement>(null)
  const [motionAllowed, setMotionAllowed] = useState(false)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forced = window.matchMedia('(forced-colors: active)')
    const marks = new Map<SVGPathElement, Mark>()
    let frame = 0
    let pointer: Point | null = null
    const clear = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      pointer = null
      for (const [path, mark] of marks) {
        path.style.filter = mark.filter
        path.style.removeProperty('--ui-chart-glow-strength')
      }
      marks.clear()
    }
    const mediaChange = () => { clear(); setMotionAllowed(!reduced.matches) }
    const render = () => {
      frame = 0
      if (!pointer || reduced.matches || forced.matches || document.hidden) { clear(); return }
      const bounds = host.getBoundingClientRect()
      if (pointer.x < bounds.left - GLOW_RADIUS || pointer.x > bounds.right + GLOW_RADIUS || pointer.y < bounds.top - GLOW_RADIUS || pointer.y > bounds.bottom + GLOW_RADIUS) { clear(); return }
      const paths = host.querySelectorAll<SVGPathElement>(MARK_SELECTOR)
      for (const [path, saved] of marks) {
        if (!host.contains(path)) { path.style.filter = saved.filter; path.style.removeProperty('--ui-chart-glow-strength'); marks.delete(path) }
      }
      for (const path of paths) {
        try {
          const matrix = path.getScreenCTM()
          if (!matrix || !Number.isFinite(matrix.a * matrix.d - matrix.b * matrix.c) || matrix.a * matrix.d === matrix.b * matrix.c) continue
          const geometry = path.getAttribute('d') ?? ''
          if (!geometry.trim()) continue
          let mark = marks.get(path)
          if (!mark || mark.geometry !== geometry) {
            const length = path.getTotalLength()
            if (!Number.isFinite(length) || length <= 0) continue
            const steps = Math.min(160, Math.max(32, Math.ceil(length / 8)))
            const points = Array.from({ length: steps + 1 }, (_, i) => { const p = path.getPointAtLength(length * i / steps); return { x: p.x, y: p.y } })
            mark = { geometry, points, filter: mark?.filter ?? path.style.filter }
            marks.set(path, mark)
          }
          const inverse = matrix.inverse()
          const local = new DOMPoint(pointer.x, pointer.y).matrixTransform(inverse)
          const computed = getComputedStyle(path)
          const filled = computed.fill !== 'none' && !path.classList.contains('recharts-line-curve') && !path.classList.contains('recharts-area-curve')
          let distance = filled && path.isPointInFill(local) ? 0 : Infinity
          if (distance) {
            const points = mark.points.map(p => ({ x: matrix.a * p.x + matrix.c * p.y + matrix.e, y: matrix.b * p.x + matrix.d * p.y + matrix.f }))
            for (let i = 1; i < points.length; i++) distance = Math.min(distance, segmentDistance(pointer, points[i - 1], points[i]))
          }
          const strength = Math.max(0, 1 - distance / GLOW_RADIUS)
          // The filled area uses its curve's color, so the gradient remains unchanged.
          const curve = path.classList.contains('recharts-area-area') ? path.parentElement?.querySelector('.recharts-area-curve') : null
          const color = curve ? getComputedStyle(curve).stroke : filled ? computed.fill : computed.stroke
          path.style.setProperty('--ui-chart-glow-strength', strength.toFixed(3))
          path.style.filter = strength > 0 ? `drop-shadow(0 0 ${2 + strength * 4}px color-mix(in srgb, ${color} ${Math.round(strength * 55)}%, transparent)) drop-shadow(0 0 ${6 + strength * 8}px color-mix(in srgb, ${color} ${Math.round(strength * 22)}%, transparent))` : mark.filter
        } catch {
          // Decorative geometry must never interrupt the chart or its tooltip.
          clear()
          return
        }
      }
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reduced.matches || forced.matches) { clear(); return }
      pointer = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(render)
    }
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) clear() }
    const visibility = () => { if (document.hidden) clear() }
    mediaChange()
    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerout', leave)
    document.addEventListener('pointercancel', clear)
    document.addEventListener('keydown', clear)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', clear)
    window.addEventListener('resize', clear)
    window.addEventListener('scroll', clear, true)
    reduced.addEventListener('change', mediaChange)
    forced.addEventListener('change', mediaChange)
    return () => {
      clear()
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('pointercancel', clear)
      document.removeEventListener('keydown', clear)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', clear)
      window.removeEventListener('resize', clear)
      window.removeEventListener('scroll', clear, true)
      reduced.removeEventListener('change', mediaChange)
      forced.removeEventListener('change', mediaChange)
    }
  }, [])
  return { ref, motionAllowed }
}
