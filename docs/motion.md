# Motion

The `./motion` entry adds spring motion to Projection UI components.
It uses the Armature motion engine, pinned to `@hannasage/armature` `1.0.0-beta.1`.
Without a `MotionProvider`, every component keeps its static CSS behaviour, and `./core` loads no Armature code.

## Turn motion on

Wrap the components in a `MotionProvider`.
The provider is a client component.
In a Next.js server component, render it with no `flavor` prop, or put it in your own client file.

```tsx
import { Button, Toggle } from '@hannasage/projection-ui/core'
import { MotionProvider, projectionGlide, useMotionFlavor } from '@hannasage/projection-ui/motion'

function FlavorName() {
  return <span>{useMotionFlavor().name}</span>
}

export function Settings({ on, setOn }: { on: boolean; setOn: (value: boolean) => void }) {
  return (
    <MotionProvider flavor={projectionGlide}>
      <Button type="button">Save</Button>
      <Toggle label="Notifications" checked={on} onChange={setOn} />
      <FlavorName />
    </MotionProvider>
  )
}
```

`./motion` is ESM only.
A CommonJS `require` of it fails with an export error.
The other entries keep their CommonJS builds.

## What moves

- Button: a pointer press springs the scale down, and the release springs it back. Keyboard activation and a disabled button do not move.
- Toggle: the thumb springs to the new side on every input, keyboard included. The track fill fades with the thumb.
- Slider: a pointer grab springs the thumb scale up, and the release springs it back. Arrow keys and a drag move the value at once.
- ButtonGroup and Tabs: an indicator travels to the option a pointer picks. Arrow keys, Home, and End make it jump. With no selection it hides.

Colour changes stay CSS transitions on `--ui-motion-fast` and `--ui-motion-normal`.
A change in flight starts from the current value and keeps its speed.
The server render shows every component at rest and reads no browser global.

Under reduced motion, every motion snaps to rest.
If the reader turns reduced motion on during a move, the move stops at rest at once.

## Flavors

A flavor is the movement language.
Both flavors use the same component code.
`useMotionFlavor()` returns the flavor of the nearest provider.
With no provider, it returns `projection`.

### Mechanical (`projection`)

Crisp and tactile. A small overshoot, then done. The default.
The press scale is 0.97, and the Slider grab scale is 1.15.

- `mechanical`: stiffness 600, damping 28.0, mass 1. Damping ratio 0.572. Measured overshoot 9.0 percent. Measured settle time 223 ms.
- `settle`: stiffness 600, damping 49.0, mass 1. Damping ratio 1.000. Measured overshoot 0.0 percent. Measured settle time 256 ms.

### Glide (`projectionGlide`)

Calm and slow to settle, with no bounce. The press is shallower.
The press scale is 0.985, and the Slider grab scale is 1.1.

- `glide`: stiffness 429, damping 41.4, mass 1. Damping ratio 1.000. Measured overshoot 0.0 percent. Measured settle time 300 ms.
- `settle`: stiffness 600, damping 49.0, mass 1. Damping ratio 1.000. Measured overshoot 0.0 percent. Measured settle time 256 ms.

## Where the numbers come from

`UI_FOUNDATIONS.motion` holds the inputs: `mechanical-stiffness`, `mechanical-damping`, `settle-stiffness`, and `glide-settle`.
`settle` and `glide` are critically damped with Armature's `criticalDamping`.
The `glide` stiffness is the whole number whose settle time, stepped by the Armature solver, is closest to `glide-settle`.

The measured numbers above come from the Armature solver.
It steps each spring from 0 to 1 in fixed slices of 1/120 s.
The overshoot is the largest value minus 1.
The settle time is the time after which the value stays within 2 percent of the target.
A test measures each spring of the packed package.
If this page differs from the measurement, the test fails.

## Stability

The flavor names `projection` and `projection-glide` and the `pui` prefix are stable names.
Spring numbers are not frozen.
The `--pui-*` CSS variables and the `data-pui-*` attributes are internal and can change in any release.
