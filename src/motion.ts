'use client'

// The motion entry. ESM only (D5). It exports the two flavors, MotionProvider, and useMotionFlavor (D7).
// The component hooks and the --pui-* variable names stay internal.
export { projection, projectionGlide } from './motion/flavors'
export { MotionProvider, useMotionFlavor } from './motion/MotionProvider'
export type { MotionProviderProps } from './motion/MotionProvider'
export type { MotionFlavor } from './motion/flavors'
