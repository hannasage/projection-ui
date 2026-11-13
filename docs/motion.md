# Motion

The `./motion` entry adds spring motion to Projection UI components.
It uses the Armature motion engine, `@hannasage/armature`.
Without a `MotionProvider`, every component keeps its static CSS behaviour, and `./core` loads no Armature code.

## Install

The motion engine is an optional peer dependency.
Installing Projection UI does not install it.
To use `./motion`, install the exact version that Projection UI pins:

```sh
npm install @hannasage/armature@1.0.0-beta.1
```

Without it, every other entry works, and an import of `./motion` fails with a module-not-found error that names `@hannasage/armature`.

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
When you use `./motion`, import `./core` as ESM too. A CommonJS `require` of `./core` loads a second copy of the components, and a `MotionProvider` does not reach that copy.

### Keep the flavor in module scope

Pass `projection` or `projectionGlide` as they are.
Both are constants at module scope, so the flavor keeps its identity from one render to the next.
The `flavor` prop takes only these two. Its type is `MotionFlavor`, which `./motion` exports. A hand-made object is not a flavor.
When the flavor identity changes, every motion controller inside the provider restarts.
Outside production, the provider then logs one warning.

### Nested providers

A nested `MotionProvider` sets the flavor for its subtree.
No provider turns motion off for a subtree.
To turn motion off, leave the subtree outside every provider, or rely on the reader's reduced-motion setting.

A per-component `flavor` prop is deferred. An earlier plan listed one. Phase 1 ships the opt-in provider only. The prop can arrive later as an additive change.

## What moves

- Button: a pointer press springs the scale down, and the release springs it back. Keyboard activation and a disabled button do not move.
- Toggle: the thumb springs to the new side on every input, keyboard included. The track fill fades with the thumb.
- Slider: a pointer grab springs the thumb scale up, and the release springs it back. Arrow keys and a drag move the value at once. A value set from code jumps too: the thumb has no spring for its position.
- ButtonGroup and Tabs: an indicator travels to the option a pointer picks. A key makes it jump: an arrow key, Home, End, or Enter or Space on a focused option. With no selection it hides. When an option changes size, or a web font loads, the indicator refits to the active option.

Colour changes stay CSS transitions on `--ui-motion-fast` and `--ui-motion-normal`.
A change in flight starts from the current value and keeps its speed.
The server render shows every component at rest and reads no browser global.

Under reduced motion, every motion snaps to rest, and the colour fades of the motion components turn off.
If the reader turns reduced motion on during a move, the move stops at rest at once.
Under forced colors, a mode where the system sets a small palette, each indicator draws in the system color `Highlight`, and the text of the active chip or segment uses `HighlightText`.

Where `matchMedia` or `ResizeObserver` is missing, as in jsdom, the components still start and log no error.
Without `matchMedia`, nothing watches the reduced-motion setting. Without `ResizeObserver`, the indicator does not refit on a resize.

## Why clip-path

Each indicator shows its box with `clip-path: inset(...)`.
No layout property and no `transform` moves.
The `round` part of `inset()` keeps the chip radius exact while the box changes width, and the Tabs underline stays exactly 2 px tall.
A `transform: scale()` would stretch that radius and that line.
The cost is a repaint of one small element on each frame of a move.

## Flavors

A flavor is the movement language.
Both flavors use the same component code.
`useMotionFlavor()` returns the flavor of the nearest provider.
With no provider, it returns `projection`.

### Mechanical (`projection`)

Crisp and tactile. A small overshoot, then done. The default.
The press scale is 0.97, and the Slider grab scale is 1.15.
Press, release, and the Toggle thumb use `mechanical`.
The ButtonGroup and Tabs indicators use `settle`, so an indicator never bounces past its option.

- `mechanical`: stiffness 600, damping 28.0, mass 1. Damping ratio 0.572. Measured overshoot 9.0 percent. Measured settle time 223 ms.
- `settle`: stiffness 600, damping 49.0, mass 1. Damping ratio 1.000. Measured overshoot 0.0 percent. Measured settle time 256 ms.

### Glide (`projectionGlide`)

Calm and slow to settle, with no bounce. The press is shallower.
The press scale is 0.985, and the Slider grab scale is 1.1.
Every moving part, the indicators included, uses `glide`.

- `glide`: stiffness 429, damping 41.4, mass 1. Damping ratio 1.000. Measured overshoot 0.0 percent. Measured settle time 300 ms.
- `settle`: stiffness 600, damping 49.0, mass 1. Damping ratio 1.000. Measured overshoot 0.0 percent. Measured settle time 256 ms.

## Where the numbers come from

`UI_FOUNDATIONS.motion` holds the inputs: `mechanical-stiffness`, `mechanical-damping`, `settle-stiffness`, and `glide-settle`.
These four key names are frozen. Their values are not.
The token stylesheets print them as `--ui-motion-mechanical-stiffness`, `--ui-motion-mechanical-damping`, `--ui-motion-settle-stiffness`, and `--ui-motion-glide-settle`.
Those CSS variables are informational and read-only. Setting them changes nothing: the springs are built from `UI_FOUNDATIONS.motion` when `./motion` loads.
`settle` and `glide` are critically damped with Armature's `criticalDamping`.
The `glide` stiffness is the whole number whose settle time, stepped by the Armature solver, is closest to `glide-settle`.

The measured numbers above come from the Armature solver.
It steps each spring from 0 to 1 in fixed slices of 1/120 s.
The overshoot is the largest value minus 1.
The settle time is the time after which the value stays within 2 percent of the target.
A test measures each spring of the packed package.
If this page differs from the measurement, the test fails.

## Size

A test builds an app with `./core` alone and with `./core` and `./motion`, minified with whitespace removed.
It fails when `./motion` adds more than 8,050 bytes gzipped.

## Browsers

The browser tests read rendered values in Chromium.
The Slider grab and the Toggle thumb also run in Firefox and WebKit where Playwright has those browsers installed.
CI installs Chromium only, so there they are skipped. This is a known gap.

## Stability

The flavor names `projection` and `projection-glide` and the `pui` prefix are stable names.
Spring numbers are not frozen.
The `--pui-*` CSS variables and the `data-pui-*` attributes are internal and can change in any release.
