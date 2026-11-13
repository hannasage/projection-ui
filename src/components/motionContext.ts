import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type Ref, type RefObject } from 'react'

/** A box in the coordinates of a container's padding box. */
export interface MotionBox { x: number; y: number; w: number; h: number }

/** The followers of the flavors: the Toggle thumb, the enter of a toast and a tooltip, and the dialog and backdrop of a Modal. */
export type MotionFollowerName = 'thumb' | 'enter' | 'dialog' | 'backdrop'

export interface MotionFollowerHandle { setTarget(target: number): void }
export interface MotionLensHandle { update(change?: { keyboard?: boolean }): void; refit(): void }
export interface MotionStarted<H> { handle: H; stop(): void }

/**
 * The motion engine as the components see it. `MotionProvider` from `./motion` supplies one.
 * Without a provider the components render their static markup, and this module imports no motion code, so `./core` never loads Armature.
 * Each method starts a controller on a mounted element. Nothing here runs on the server: the hooks below call it from effects only.
 * Internal: no entry exports it, so the public motion surface stays small.
 */
export interface MotionRuntime {
  /** A press scale on pointer down and a spring back on release. `grab` is the Slider thumb feel. Returns the stop function. */
  press(element: HTMLElement, feel?: 'grab'): () => void
  /** One number that springs toward a target and is written as `--pui-<name>` on the element. */
  follower(element: HTMLElement, name: MotionFollowerName, initial: number): MotionStarted<MotionFollowerHandle>
  /** A travelling indicator. It writes `--pui-lens-*` and `data-pui-lens` on the container. */
  lens(container: HTMLElement, measure: () => MotionBox | null): MotionStarted<MotionLensHandle>
}

export const MotionContext = createContext<MotionRuntime | null>(null)

export function useMotionRuntime(): MotionRuntime | null {
  return useContext(MotionContext)
}

/** The box of `element` inside `container`, or null when it is missing or has no size. */
export function boxWithin(container: HTMLElement, element: HTMLElement | null | undefined): MotionBox | null {
  if (!element) return null
  const outer = container.getBoundingClientRect()
  const inner = element.getBoundingClientRect()
  if (!(inner.width > 0) || !(inner.height > 0)) return null
  return { x: inner.left - outer.left - container.clientLeft, y: inner.top - outer.top - container.clientTop, w: inner.width, h: inner.height }
}

/** Pointer press motion for an enabled element. Keyboard activation gets none. */
export function usePressMotion(ref: RefObject<HTMLElement | null>, runtime: MotionRuntime | null, enabled: boolean, feel?: 'grab'): void {
  useEffect(() => {
    const element = ref.current
    if (!runtime || !enabled || !element) return
    return runtime.press(element, feel)
  }, [ref, runtime, enabled, feel])
}

/** A follower that starts on `target` with no motion, then springs to each new target and keeps its speed when a change comes in flight. */
export function useFollowerMotion(ref: RefObject<HTMLElement | null>, runtime: MotionRuntime | null, name: MotionFollowerName, target: number): void {
  const follower = useRef<MotionFollowerHandle | null>(null)
  const latest = useRef(target)
  useEffect(() => { latest.current = target })
  useEffect(() => {
    const element = ref.current
    if (!runtime || !element) return
    const started = runtime.follower(element, name, latest.current)
    follower.current = started.handle
    return () => {
      started.stop()
      follower.current = null
    }
  }, [ref, runtime, name])
  useEffect(() => { follower.current?.setTarget(target) }, [target])
}

const subscribeNothing = () => () => undefined

/**
 * An enter: while `active` is true and the element is mounted, a follower writes `--pui-<name>` from 0 to 1, so the element enters
 * from its start pose and rests at 1. With `animate` false, or when React hydrates the element from server markup, it starts at 1 with
 * no motion. It runs before paint, so the element is never drawn at rest before its enter. Leaving is not animated: the element
 * leaves the page with `active`.
 */
export function useEnterMotion(ref: RefObject<HTMLElement | null>, runtime: MotionRuntime | null, name: MotionFollowerName, active: boolean, animate = true): void {
  // False on the server and while React hydrates, true for a render on the client alone.
  const client = useSyncExternalStore(subscribeNothing, () => true, () => false)
  const moves = useRef(false)
  useLayoutEffect(() => { moves.current = animate && client })
  useLayoutEffect(() => {
    const element = ref.current
    if (!runtime || !active || !element) return
    const started = runtime.follower(element, name, moves.current ? 0 : 1)
    started.handle.setTarget(1)
    return started.stop
  }, [ref, runtime, name, active])
}

/**
 * A lens over the active option. It takes its first place at once, travels on a pointer change, and jumps when `keyboard.current`
 * says a key made the change, so keyboard selection never animates across the row. The component sets the flag on a navigation key
 * and on a click with `detail` 0 (Enter or Space), and clears it on keyup and blur. This hook clears it after each change.
 */
export function useLensMotion(ref: RefObject<HTMLElement | null>, runtime: MotionRuntime | null, measure: () => MotionBox | null, active: unknown, keyboardRef: RefObject<boolean>): void {
  const lens = useRef<MotionLensHandle | null>(null)
  const latest = useRef(measure)
  useEffect(() => { latest.current = measure })
  const options = useRef<ResizeObserver | null>(null)
  const observed = useRef(new Set<Element>())
  useEffect(() => {
    const container = ref.current
    if (!runtime || !container) return
    const started = runtime.lens(container, () => latest.current())
    lens.current = started.handle
    started.handle.update()
    // The engine refits when the container resizes. An option can resize while the container keeps its size, for example when
    // its label changes or a web font loads, so each option is watched too, and the lens refits once the fonts are ready.
    let alive = true
    const watched = observed.current
    if (typeof ResizeObserver === 'function') options.current = new ResizeObserver(() => { if (alive) started.handle.refit() })
    if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(() => { if (alive) started.handle.refit() }, () => undefined)
    return () => {
      alive = false
      options.current?.disconnect()
      options.current = null
      watched.clear()
      started.stop()
      lens.current = null
    }
  }, [ref, runtime])
  // After every render, watch the options that are in the container now and stop watching the ones that left.
  useEffect(() => {
    const container = ref.current
    const observer = options.current
    if (!container || !observer) return
    const current = new Set(Array.from(container.children))
    for (const element of observed.current) if (!current.has(element)) { observer.unobserve(element); observed.current.delete(element) }
    for (const element of current) if (!observed.current.has(element)) { observer.observe(element); observed.current.add(element) }
  })
  useEffect(() => {
    lens.current?.update({ keyboard: keyboardRef.current })
    keyboardRef.current = false
  }, [active, keyboardRef])
}

/** Sets a ref of any kind to a node. */
function assignRef<T>(target: Ref<T> | undefined, node: T | null): void {
  if (typeof target === 'function') target(node)
  else if (target) (target as RefObject<T | null>).current = node
}

/** One callback ref that sets a local ref and a ref passed in props, so motion never takes a consumer's ref away. */
export function useMergedRef<T>(localRef: RefObject<T | null>, passedRef: Ref<T> | undefined): (node: T | null) => void {
  return useCallback((node: T | null) => {
    assignRef(localRef, node)
    assignRef(passedRef, node)
  }, [localRef, passedRef])
}
