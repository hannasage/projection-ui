import React, { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
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
    __unmount: () => void
    __mount: () => void
    __pressRef: React.RefObject<HTMLButtonElement | null> | null
    __legacyListeners?: () => number
  }
}

// Query options: flavor=glide, provider=none (no MotionProvider), strict (React StrictMode), nested (an inner Glide provider),
// and hydrate (server markup first, then hydrateRoot). The page's index.html handles bare (no matchMedia, no ResizeObserver).
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
  // A pointer click: detail 1, as a mouse gives. element.click() would give detail 0, which is how Enter and Space activate a button.
  if (action.type === 'click') element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0 }))
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
// Older Safari has only addListener, which the legacymq option of the page imitates.
if (typeof window.matchMedia === 'function') {
  const list = matchMedia('(prefers-reduced-motion: reduce)')
  const flipped = () => { window.__flipAt = performance.now() }
  if (typeof list.addEventListener === 'function') list.addEventListener('change', flipped)
  else (list as MediaQueryList).addListener(flipped)
}

function FlavorName({ testId = 'flavor' }: { testId?: string }) {
  return <output data-testid={testId}>{useMotionFlavor().name}</output>
}

// An inner provider with Glide, and a button that swaps its flavor, which a provider warns about once outside production.
function Nested() {
  const [glide, setGlide] = useState(true)
  return (
    <MotionProvider flavor={glide ? projectionGlide : projection}>
      <FlavorName testId="nested-flavor" />
      <Button type="button" data-testid="nested-press">Nested press</Button>
      <button type="button" data-testid="swap-flavor" onClick={() => setGlide(value => !value)}>Swap the inner flavor</button>
    </MotionProvider>
  )
}

function Fixture() {
  const [on, setOn] = useState(false)
  const [level, setLevel] = useState(40)
  const [mode, setMode] = useState<string | null>('day')
  const [segment, setSegment] = useState<string | null>('one')
  const [wrapped, setWrapped] = useState<string | null>('alpha')
  const [presses, setPresses] = useState(0)
  const pressRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { window.__pressRef = pressRef }, [])
  return (
    <ThemeProvider theme={DEFAULT_THEME} style={{ padding: 24 }}>
      <h1>Motion fixture</h1>
      <FlavorName />
      <p><Button type="button" data-testid="press" ref={pressRef} onClick={() => setPresses(count => count + 1)}>Press me</Button> <Button type="button" data-testid="disabled-press" disabled>Disabled press</Button> <output data-testid="presses">{presses}</output></p>
      <Toggle label="Notifications" checked={on} onChange={setOn} />
      <div data-testid="slider-box" style={{ width: 240 }}><Slider label="Level" value={level} onChange={setLevel} /></div>
      <div data-testid="mode-box"><ButtonGroup aria-label="Mode" deselectable value={mode} onChange={value => setMode(value || null)} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'off', label: 'Off', disabled: true }, { value: 'month', label: 'Month' }]} /></div>
      <ButtonGroup aria-label="Segment" variant="segmented" value={segment} onChange={setSegment} options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }, { value: 'three', label: 'Three' }]} />
      <div style={{ width: 150 }}><ButtonGroup aria-label="Wrapped" value={wrapped} onChange={setWrapped} options={['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map(value => ({ value, label: value }))} /></div>
      <Tabs label="Sections" items={[{ value: 'one', label: 'First', content: 'First panel' }, { value: 'two', label: 'Second', content: 'Second panel' }, { value: 'three', label: 'Third', content: 'Third panel' }, { value: 'four', label: 'Fourth', content: 'Fourth panel', disabled: true }]} />
      <p><button type="button" data-testid="set-week" onClick={() => setMode('week')}>Set week from outside</button></p>
      {params.has('nested') && <Nested />}
    </ThemeProvider>
  )
}

const container = document.getElementById('root')!
const app = () => {
  const tree = params.get('provider') === 'none' ? <Fixture /> : <MotionProvider flavor={flavor}><Fixture /></MotionProvider>
  return params.has('strict') ? <StrictMode>{tree}</StrictMode> : tree
}
let root: Root | null = null
window.__unmount = () => { root?.unmount(); root = null }
window.__mount = () => { root = createRoot(container); root.render(app()) }
if (params.has('hydrate')) {
  container.innerHTML = renderToString(app())
  root = hydrateRoot(container, app())
} else window.__mount()
