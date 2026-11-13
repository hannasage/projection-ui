import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ButtonGroup, Slider, Tabs, ThemeProvider, Toggle } from '@hannasage/projection-ui/core'
import { DEFAULT_THEME } from '@hannasage/projection-ui/foundations'
import { MotionProvider, projection, projectionGlide, useMotionFlavor } from '@hannasage/projection-ui/motion'
import '@hannasage/projection-ui/styles'

type Read = { selector: string; property: string; pseudo?: string; fallback?: number }
type Action = { at: number; selector: string; type: 'click' | 'pointerdown' | 'pointerup' | 'keydown' | 'width'; key?: string; value?: string }
type Sample = { t: number; v: number }

declare global {
  interface Window {
    __sample: (options: { read: Read; ms: number; actions?: Action[] }) => Promise<{ values: Sample[]; marks: number[] }>
    __box: (group: string, option: string) => { x: number; y: number; w: number; h: number }
    __flipAt: number | null
  }
}

const params = new URLSearchParams(location.search)
const flavor = params.get('flavor') === 'glide' ? projectionGlide : projection

function read(spec: Read): number {
  const element = document.querySelector(spec.selector)
  if (!element) throw new Error(`no element for ${spec.selector}`)
  const raw = getComputedStyle(element, spec.pseudo ?? null).getPropertyValue(spec.property).trim()
  if (raw === '' || raw === 'none') return spec.fallback ?? Number.NaN
  return Number.parseFloat(raw)
}

function fire(action: Action): void {
  const element = document.querySelector<HTMLElement>(action.selector)
  if (!element) throw new Error(`no element for ${action.selector}`)
  if (action.type === 'click') element.click()
  else if (action.type === 'width') element.style.width = action.value ?? ''
  else if (action.type === 'keydown') {
    element.focus()
    element.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, bubbles: true, cancelable: true }))
  } else {
    const box = element.getBoundingClientRect()
    element.dispatchEvent(new PointerEvent(action.type, { bubbles: true, isPrimary: true, button: 0, pointerType: 'mouse', clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }))
  }
}

window.__sample = ({ read: spec, ms, actions = [] }) => new Promise(resolve => {
  const queue = [...actions].sort((a, b) => a.at - b.at)
  const values: Sample[] = [{ t: 0, v: read(spec) }]
  const marks: number[] = []
  const start = performance.now()
  const frame = () => {
    const t = performance.now() - start
    while (queue.length && queue[0].at <= t) {
      fire(queue.shift()!)
      marks.push(values.length)
    }
    values.push({ t, v: read(spec) })
    if (t < ms || queue.length) requestAnimationFrame(frame)
    else resolve({ values, marks })
  }
  requestAnimationFrame(frame)
})

window.__box = (group, option) => {
  const container = document.querySelector<HTMLElement>(group)!
  const target = [...container.querySelectorAll<HTMLElement>('button')].find(node => node.textContent === option)!
  const outer = container.getBoundingClientRect()
  const inner = target.getBoundingClientRect()
  return { x: inner.left - outer.left - container.clientLeft, y: inner.top - outer.top - container.clientTop, w: inner.width, h: inner.height }
}

window.__flipAt = null
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { window.__flipAt = performance.now() })

function FlavorName() {
  return <output data-testid="flavor">{useMotionFlavor().name}</output>
}

function Fixture() {
  const [on, setOn] = useState(false)
  const [level, setLevel] = useState(40)
  const [mode, setMode] = useState<string | null>('day')
  const [segment, setSegment] = useState<string | null>('one')
  const [wrapped, setWrapped] = useState<string | null>('alpha')
  const [presses, setPresses] = useState(0)
  return (
    <ThemeProvider theme={DEFAULT_THEME} style={{ padding: 24 }}>
      <h1>Motion fixture</h1>
      <FlavorName />
      <p><Button type="button" data-testid="press" onClick={() => setPresses(count => count + 1)}>Press me</Button> <Button type="button" data-testid="disabled-press" disabled>Disabled press</Button> <output data-testid="presses">{presses}</output></p>
      <Toggle label="Notifications" checked={on} onChange={setOn} />
      <div data-testid="slider-box" style={{ width: 240 }}><Slider label="Level" value={level} onChange={setLevel} /></div>
      <div data-testid="mode-box"><ButtonGroup aria-label="Mode" deselectable value={mode} onChange={value => setMode(value || null)} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'off', label: 'Off', disabled: true }, { value: 'month', label: 'Month' }]} /></div>
      <ButtonGroup aria-label="Segment" variant="segmented" value={segment} onChange={setSegment} options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }, { value: 'three', label: 'Three' }]} />
      <div style={{ width: 150 }}><ButtonGroup aria-label="Wrapped" value={wrapped} onChange={setWrapped} options={['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map(value => ({ value, label: value }))} /></div>
      <Tabs label="Sections" items={[{ value: 'one', label: 'First', content: 'First panel' }, { value: 'two', label: 'Second', content: 'Second panel' }, { value: 'three', label: 'Third', content: 'Third panel' }, { value: 'four', label: 'Fourth', content: 'Fourth panel', disabled: true }]} />
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(<MotionProvider flavor={flavor}><Fixture /></MotionProvider>)
