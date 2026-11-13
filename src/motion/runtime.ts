import { guardedSetup, readPreferences, REDUCED_MOTION_QUERY } from '@hannasage/armature'
import { attachSurface, createFollower, createLens, type Follower, type Lens } from '@hannasage/armature/dom'
import type { MotionRuntime } from '../components/motionContext'
import { engineFlavor } from './engineFlavors'
import type { MotionFlavor } from './flavors'

/**
 * The runtime that MotionProvider gives the components. It is pure until a component calls it from an effect,
 * so a server render touches no `window` and no `matchMedia`.
 *
 * The shared reduced-motion reader: while any controller is live, one `change` listener watches the setting. When the reader
 * turns reduced motion on, every live controller snaps to rest at once. Armature's follower already checks the setting on each frame.
 * Its surface and lens check it only on the next pointer event or update, so without this a press or a lens in flight would finish its move.
 */
export function createMotionRuntime(publicFlavor: MotionFlavor): MotionRuntime {
  const flavor = engineFlavor(publicFlavor)
  const live = new Set<() => void>()
  let unwatch: (() => void) | null = null

  const settleAll = () => {
    if (readPreferences(window).reducedMotion) for (const settle of [...live]) settle()
  }
  const track = (settle: () => void) => {
    live.add(settle)
    if (!unwatch) {
      const media = window.matchMedia(REDUCED_MOTION_QUERY)
      media.addEventListener('change', settleAll)
      unwatch = () => media.removeEventListener('change', settleAll)
    }
    return () => {
      live.delete(settle)
      if (live.size === 0 && unwatch) {
        unwatch()
        unwatch = null
      }
    }
  }

  return {
    press(element, feel) {
      return guardedSetup(`${flavor.name} press`, () => {
        const options = { flavor, ...(feel ? flavor.surface.feels[feel] : undefined) }
        let surface = attachSurface(element, options)
        // Destroy leaves the element at its rest values. A fresh surface then waits for the next pointer.
        const untrack = track(() => {
          surface.destroy()
          surface = attachSurface(element, options)
        })
        return () => {
          untrack()
          surface.destroy()
        }
      }, undefined, flavor)
    },
    follower(element, name, initial) {
      let current: Follower | null = null
      const stop = guardedSetup(`${flavor.name} follower`, () => {
        const created = createFollower(element, { flavor, name, initial })
        current = created
        const untrack = track(() => created.snap())
        return () => {
          untrack()
          created.destroy()
          current = null
        }
      }, undefined, flavor)
      return { handle: { setTarget: target => current?.setTarget(target) }, stop }
    },
    lens(container, measure) {
      let current: Lens | null = null
      const stop = guardedSetup(`${flavor.name} lens`, () => {
        const created = createLens({ flavor, container, measure })
        current = created
        const untrack = track(() => created.jump())
        return () => {
          untrack()
          created.destroy()
          current = null
        }
      }, undefined, flavor)
      return { handle: { update: change => current?.update(change) }, stop }
    },
  }
}
