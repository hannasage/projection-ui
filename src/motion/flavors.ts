import { createSpring, criticalDamping, defineFlavor, FIXED_STEP, retarget, stepSpring, type Flavor, type FollowerFlavor, type LensFlavor, type SpringConfig, type SurfaceFlavor } from '@hannasage/armature'
import { UI_FOUNDATIONS } from '../foundations'

/** A flavor that carries the three parts the Projection UI surfaces use today. */
export type MotionFlavor = Flavor & { readonly surface: SurfaceFlavor; readonly followers: FollowerFlavor; readonly lens: LensFlavor }

const tokens = UI_FOUNDATIONS.motion
const seconds = (value: string) => Number.parseFloat(value) / (value.endsWith('ms') ? 1000 : 1)

/** The settle band: the value stays within 2 percent of the target. */
const BAND = 0.02

/** The time after which a critically damped spring of this stiffness stays inside the band, stepped by the Armature solver. */
function settleTime(stiffness: number): number {
  let state = retarget(createSpring({ stiffness, damping: criticalDamping(stiffness), restDelta: 1e-9, restSpeed: 1e-9 }, 0), 1)
  let settled: number | null = null
  let before = 1
  for (let step = 1; step * FIXED_STEP <= 5; step++) {
    state = stepSpring(state, 1, FIXED_STEP)
    const miss = Math.abs(state.value - 1)
    if (miss > BAND) settled = null
    else if (settled === null) settled = (step - 1) * FIXED_STEP + (FIXED_STEP * (before - BAND)) / (before - miss)
    before = miss
  }
  return settled ?? Number.POSITIVE_INFINITY
}

/** The whole stiffness whose critically damped solver settle time is closest to `target` seconds. */
function stiffnessFor(target: number): number {
  let low = 1
  let high = 10_000
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (settleTime(middle) > target) low = middle
    else high = middle
  }
  return Math.abs(settleTime(low) - target) <= Math.abs(settleTime(high) - target) ? low : high
}

const spring = (stiffness: number, damping: number): SpringConfig => ({ stiffness, damping, mass: 1 })

/** Press, release, thumb, and lens of Mechanical. Underdamped: a small overshoot, then done. */
const mechanical = spring(Number(tokens['mechanical-stiffness']), Number(tokens['mechanical-damping']))
const settleStiffness = Number(tokens['settle-stiffness'])
/** Every exit, in both flavors. Critically damped, so nothing bounces on the way out. */
const settle = spring(settleStiffness, criticalDamping(settleStiffness))
const glideStiffness = stiffnessFor(seconds(tokens['glide-settle']))
/** Press, release, thumb, and lens of Glide. Critically damped and softer than Mechanical, so it settles later with no bounce. */
const glide = spring(glideStiffness, criticalDamping(glideStiffness))

/** The parts both flavors share. Only the spring key and the two scales differ. */
function parts(key: string, pressScale: number, grabScale: number) {
  const surface: SurfaceFlavor = {
    specular: false,
    glow: false,
    vars: { press: 'press', flex: 'flex', specX: 'spec-x', specY: 'spec-y', glow: 'glow' },
    attributes: { surface: '', group: 'group', feel: 'feel' },
    springKeys: { press: key, release: key },
    rest: { restDelta: 0.0005, restSpeed: 0.01 },
    defaults: { pressScale, flex: 0, glowFalloff: 160, neighborShare: 0, specularRest: { x: 50, y: 50 } },
    specularTauMs: 90,
    glowTauMs: 140,
    hoverGlow: 0,
    feels: { grab: { pressScale: grabScale } },
  }
  const followers: FollowerFlavor = { thumb: { var: 'thumb', springKey: key, rest: { restDelta: 0.001, restSpeed: 0.01 } } }
  const lens: LensFlavor = {
    vars: { x: 'lens-x', y: 'lens-y', w: 'lens-w', h: 'lens-h', sx: 'lens-sx', sy: 'lens-sy' },
    readyAttribute: 'lens',
    readyValue: 'ready',
    springKeys: { x: key, width: key },
    rest: { restDelta: 0.05, restSpeed: 1 },
    stretchVelocity: 10_000,
    maxStretch: 0,
  }
  return { surface, followers, lens }
}

/** Mechanical: crisp and tactile. The default flavor. */
export const projection: MotionFlavor = defineFlavor({ name: 'projection', prefix: 'pui', logLabel: 'projection-ui', springs: { mechanical, settle }, ...parts('mechanical', 0.97, 1.15) })

/** Glide: calm and slow to settle, with no bounce anywhere and a shallower press. */
export const projectionGlide: MotionFlavor = defineFlavor({ name: 'projection-glide', prefix: 'pui', logLabel: 'projection-ui', springs: { glide, settle }, ...parts('glide', 0.985, 1.1) })
