'use client'

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { MotionContext } from '../components/motionContext'
import { projection, type MotionFlavor } from './flavors'
import { createMotionRuntime } from './runtime'

export interface MotionProviderProps {
  /** The movement language: `projection` (Mechanical, the default) or `projectionGlide` (Glide). */
  flavor?: MotionFlavor
  children?: React.ReactNode
}

const FlavorContext = createContext<MotionFlavor | null>(null)

// Bundlers define `process.env.NODE_ENV`. The library does not depend on Node types, so it declares only what it reads.
declare const process: { env: { NODE_ENV?: string } }

/** True outside a production build. A bundler replaces `process.env.NODE_ENV`. Where nothing defines `process`, this is false. */
function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

/**
 * Turns on spring motion for the Projection UI components inside it. Without it the components keep their static CSS behaviour.
 * The server render shows every component at rest.
 *
 * Pass `projection` or `projectionGlide` as they are: both are module-level constants, so the flavor keeps its identity across renders.
 * A new flavor identity restarts every motion controller inside the provider, so outside production the provider warns once when it
 * sees one. A nested provider changes the flavor for its subtree. No provider turns motion off for a subtree.
 */
export function MotionProvider({ flavor = projection, children }: MotionProviderProps): React.ReactElement {
  const runtime = useMemo(() => createMotionRuntime(flavor), [flavor])
  const previous = useRef(flavor)
  const warned = useRef(false)
  useEffect(() => {
    if (previous.current === flavor) return
    previous.current = flavor
    if (warned.current || !isDevelopment()) return
    warned.current = true
    console.warn('[projection-ui] MotionProvider: the flavor changed between renders, so every motion controller inside it restarted. Pass projection or projectionGlide as they are, and change the flavor only on purpose. This warning shows once per provider, outside production.')
  }, [flavor])
  return (
    <FlavorContext.Provider value={flavor}>
      <MotionContext.Provider value={runtime}>{children}</MotionContext.Provider>
    </FlavorContext.Provider>
  )
}

/** The flavor of the nearest MotionProvider, or Mechanical when there is none. */
export function useMotionFlavor(): MotionFlavor {
  return useContext(FlavorContext) ?? projection
}
