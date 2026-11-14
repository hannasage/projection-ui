import { createBrowserEnvironment, guardedSetup, logTag, readPreferences, REDUCED_MOTION_QUERY } from '@hannasage/armature'
import { attachSurface, createFollower, createLens, type Follower, type Lens } from '@hannasage/armature/dom'
import type { MotionRuntime } from '../components/motionContext'
import { engineFlavor } from './engineFlavors'
import type { MotionFlavor } from './flavors'

/** The browser environment for the lens. Where ResizeObserver is missing, as in jsdom, the lens refits only when asked. */
function lensEnvironment() {
  const browser = createBrowserEnvironment()
  return typeof ResizeObserver === 'function' ? browser : { ...browser, observeResize: undefined }
}

/**
 * The runtime that MotionProvider gives the components. It is pure until a component calls it from an effect,
 * so a server render touches no `window` and no `matchMedia`.
 *
 * The shared reduced-motion reader: while any controller is live, one `change` listener watches the setting. When the reader
 * turns reduced motion on, every live controller snaps to rest at once. Armature's follower already checks the setting on each frame.
 * Its surface and lens check it only on the next pointer event or update, so without this a press or a lens in flight would finish its move.
 * Where `matchMedia` is missing, as in jsdom, nothing watches the setting and every controller still starts.
 *
 * Each method registers with the reader before it creates its controller, so a failure leaves nothing behind.
 */
export function createMotionRuntime(publicFlavor: MotionFlavor): MotionRuntime {
  const flavor = engineFlavor(publicFlavor)
  const live = new Set<() => void>()
  let unwatch: (() => void) | null = null

  // Each controller stops on its own, so one that throws cannot keep the others moving. Its error is reported, not rethrown.
  const settleAll = () => {
    if (!readPreferences(window).reducedMotion) return
    for (const settle of [...live]) {
      try {
        settle()
      } catch (error) {
        console.error(`${logTag(flavor)} A motion controller failed to stop for reduced motion and was skipped.`, error)
      }
    }
  }
  const track = (settle: () => void) => {
    live.add(settle)
    if (!unwatch && typeof window.matchMedia === 'function') {
      const media = window.matchMedia(REDUCED_MOTION_QUERY)
      if (typeof media?.addEventListener === 'function') {
        media.addEventListener('change', settleAll)
        unwatch = () => media.removeEventListener('change', settleAll)
      } else if (typeof media?.addListener === 'function') {
        // Older Safari has only the deprecated addListener and removeListener.
        media.addListener(settleAll)
        unwatch = () => media.removeListener(settleAll)
      }
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
        let surface: ReturnType<typeof attachSurface> | null = null
        // Destroy leaves the element at its rest values. A fresh surface then waits for the next pointer.
        const untrack = track(() => {
          surface?.destroy()
          surface = attachSurface(element, options)
        })
        try {
          surface = attachSurface(element, options)
        } catch (error) {
          untrack()
          throw error
        }
        return () => {
          untrack()
          surface?.destroy()
        }
      }, undefined, flavor)
    },
    follower(element, name, initial) {
      let current: Follower | null = null
      const stop = guardedSetup(`${flavor.name} follower`, () => {
        const untrack = track(() => current?.snap())
        try {
          current = createFollower(element, { flavor, name, initial })
        } catch (error) {
          untrack()
          throw error
        }
        const created = current
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
        const untrack = track(() => current?.jump())
        try {
          current = createLens({ flavor, container, measure, env: lensEnvironment() })
        } catch (error) {
          untrack()
          throw error
        }
        const created = current
        return () => {
          untrack()
          created.destroy()
          current = null
        }
      }, undefined, flavor)
      return { handle: { update: change => current?.update(change), refit: () => current?.refit() }, stop }
    },
  }
}
