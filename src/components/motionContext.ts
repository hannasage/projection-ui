import { createContext, useCallback, useContext, useEffect, useRef, type Ref, type RefObject } from 'react'

/** A box in the coordinates of a container's padding box. */
export interface MotionBox { x: number; y: number; w: number; h: number }

export interface MotionFollowerHandle { setTarget(target: number): void }
export interface MotionLensHandle { update(change?: { keyboard?: boolean }): void; refit(): void }
export interface MotionStarted<H> { handle: H; stop(): void }

/**
 * The motion engine as the components see it. `MotionProvider` from `./motion` supplies one.
 * Without a provider the components render their static markup, and this module imports no motion code, so `./core` never loads Armature.
 * Each method starts a controller on a mounted element. Nothing here runs on the server: the hooks below call it from effects only.
 * Internal: not exported from any entry (D7).
 */
export interface MotionRuntime {
  /** A press scale on pointer down and a spring back on release. `grab` is the Slider thumb feel. Returns the stop function. */
  press(element: HTMLElement, feel?: 'grab'): () => void
  /** One number that springs toward a target and is written as `--pui-<name>` on the element. */
  follower(element: HTMLElement, name: 'thumb', initial: number): MotionStarted<MotionFollowerHandle>
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
export function useFollowerMotion(ref: RefObject<HTMLElement | null>, runtime: MotionRuntime | null, name: 'thumb', target: number): void {
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

/**
 * A lens over the active option. It takes its first place at once, travels on a pointer change, and jumps when `keyboard.current`
 * says a key made the change (D15). The flag is cleared after each change.
 */
export function useLensMotion(ref: RefObject<HTMLElement | null>, runtime: MotionRuntime | null, measure: () => MotionBox | null, active: unknown, keyboardRef: RefObject<boolean>): void {
  const lens = useRef<MotionLensHandle | null>(null)
  const latest = useRef(measure)
  useEffect(() => { latest.current = measure })
  useEffect(() => {
    const container = ref.current
    if (!runtime || !container) return
    const started = runtime.lens(container, () => latest.current())
    lens.current = started.handle
    started.handle.update()
    return () => {
      started.stop()
      lens.current = null
    }
  }, [ref, runtime])
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
