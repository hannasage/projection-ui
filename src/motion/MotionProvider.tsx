'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { MotionContext } from '../components/motionContext'
import { projection, type MotionFlavor } from './flavors'
import { createMotionRuntime } from './runtime'

export interface MotionProviderProps {
  /** The movement language: `projection` (Mechanical, the default) or `projectionGlide` (Glide). */
  flavor?: MotionFlavor
  children?: React.ReactNode
}

const FlavorContext = createContext<MotionFlavor | null>(null)

/**
 * Turns on spring motion for the Projection UI components inside it. Without it the components keep their static CSS behaviour.
 * The server render shows every component at rest.
 */
export function MotionProvider({ flavor = projection, children }: MotionProviderProps): React.ReactElement {
  const runtime = useMemo(() => createMotionRuntime(flavor), [flavor])
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
