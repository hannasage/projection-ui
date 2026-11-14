import { glideFlavor, mechanicalFlavor } from './engineFlavors'

declare const flavorBrand: unique symbol

/**
 * The Mechanical flavor. Only its name and prefix are public. The rest of the object belongs to the motion engine,
 * so the public types do not depend on the engine's own types.
 */
export interface ProjectionMechanicalFlavor { readonly name: 'projection'; readonly prefix: 'pui'; readonly [flavorBrand]: 'projection' }

/** The Glide flavor. Only its name and prefix are public. */
export interface ProjectionGlideFlavor { readonly name: 'projection-glide'; readonly prefix: 'pui'; readonly [flavorBrand]: 'projection-glide' }

/** Mechanical: crisp and tactile. The default flavor. */
export const projection = mechanicalFlavor as unknown as ProjectionMechanicalFlavor

/** Glide: calm and slow to settle, with no bounce anywhere and a shallower press. */
export const projectionGlide = glideFlavor as unknown as ProjectionGlideFlavor

/** A flavor that `MotionProvider` accepts: `projection` or `projectionGlide`. Hand-made objects are not flavors. */
export type MotionFlavor = typeof projection | typeof projectionGlide
