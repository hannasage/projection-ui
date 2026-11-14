'use client'

// The motion entry. It is ESM only, because the motion engine ships ESM only. It exports the two flavors, the MotionFlavor type,
// MotionProvider, and useMotionFlavor, and nothing more.
// The component hooks and the --pui-* variable names stay internal.
export { projection, projectionGlide } from './motion/flavors'
export { MotionProvider, useMotionFlavor } from './motion/MotionProvider'
export type { MotionProviderProps } from './motion/MotionProvider'
export type { MotionFlavor } from './motion/flavors'
