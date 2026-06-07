# CLAUDE.md — @hannasage/projection-ui

This file is read by Claude Code at the start of every session.
It is the authoritative reference for everything about this library — its purpose, component inventory, design system, build process, and contribution rules.

---

## Project Identity

**`@hannasage/projection-ui`** is a dark-first React component library and design token system. It is the shared UI foundation for the entire Sage Advice product suite: SageCRM, SageSpec, CarCanvas, and the financial-projections planner. It is independently versioned and published to npm.

**Repo:** `hannasage/projection-ui`  
**npm:** `@hannasage/projection-ui`  
**Published:** Public, MIT licensed  
**Used by:** `hannasage/sageadvice-crm` · `hannasage/sagespec` · `hannasage/carcanvas` · `hannasage/financial-projections`

---

## Core Design Philosophy

- **Dark-first, always.** The default theme is built for dark backgrounds. Light themes are opt-in via `ThemeProvider` override — never the default.
- **Consumer-configured via ThemeProvider.** Every color, font, and radius value flows through CSS custom properties set by `ThemeProvider`. No component hardcodes a color value.
- **CSS variables, never raw values.** All components use `var(--ui-primary)`, `var(--ui-surface)`, etc. If you find a raw hex value in a component file, it is a bug.
- **Accessibility first.** Every interactive component meets WCAG 2.1 AA contrast minimums. `axe-core` is run in CI. No component ships with a contrast violation.
- **No opinions about routing, state, or data.** This library provides primitives. It does not prescribe how consumers fetch data, manage state beyond what's explicitly provided (`useToastStore`), or route between pages.
- **Peer dependencies, not bundled.** React, recharts, zustand, and @dnd-kit are peer dependencies. They are not bundled into the output. Consumers supply them.

---

## Directory Structure

```
projection-ui/
├── src/
│   ├── tokens/
│   │   └── theme.css              ← single source of truth for all CSS custom properties
│   ├── components/
│   │   ├── index.ts               ← barrel export: everything consumers need
│   │   ├── ThemeProvider.tsx      ← writes CSS vars from UITheme object
│   │   ├── Button.tsx             ← variants: primary, secondary, ghost, danger
│   │   ├── ButtonGroup.tsx        ← segmented control / tab bar
│   │   ├── Card.tsx               ← surface container with optional accent
│   │   ├── Modal.tsx              ← accessible dialog with backdrop
│   │   ├── DataTable.tsx          ← sortable, with loading skeletons
│   │   ├── Skeleton.tsx           ← loading placeholder
│   │   ├── Toast.tsx              ← toast component + useToastStore
│   │   ├── ToastContainer.tsx     ← renders active toasts, place at app root
│   │   ├── Sortable.tsx           ← SortableList + SortableItem (@dnd-kit wrappers)
│   │   ├── forms/
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Textarea.tsx
│   │   │   └── Toggle.tsx
│   │   └── charts/
│   │       ├── AreaChart.tsx
│   │       ├── BarChart.tsx
│   │       ├── LineChart.tsx
│   │       └── DonutChart.tsx
│   └── index.ts                   ← re-exports components + theme.css side-effect import
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── stories/                       ← one .stories.tsx file per component
├── package.json
├── tsconfig.json
├── vite.config.ts                 ← library mode build
└── README.md
```

---

## Component Inventory

### Layout & Containers
| Component | Export | Description |
|-----------|--------|-------------|
| `ThemeProvider` | named | Writes `UITheme` object as CSS custom properties. Wrap app root. |
| `ToastContainer` | named | Renders active toasts. Place once at app root alongside ThemeProvider. |
| `Card` | named | Surface container. Accepts `accent` (color string) for left-border highlight. |
| `Modal` | named | Accessible dialog. Handles focus trap, backdrop click, escape key. |

### Interactive
| Component | Export | Description |
|-----------|--------|-------------|
| `Button` | named | Variants: `primary`, `secondary`, `ghost`, `danger`. All WCAG AA. |
| `ButtonGroup` | named | Segmented control. Used for tab bars, filter toggles, multi-select. |
| `DataTable` | named | Sortable table with loading skeleton state. Accepts `columns`, `data`, `loading`. |
| `SortableList` | named | `@dnd-kit` wrapper. Drag-and-drop ordered list. |
| `SortableItem` | named | Individual draggable item within `SortableList`. Exposes `dragHandleProps`. |

### Forms
| Component | Export | Description |
|-----------|--------|-------------|
| `Input` | named | Text input with label, error state, helper text. |
| `Select` | named | Dropdown select with label and error state. |
| `Textarea` | named | Multi-line text input with label and error state. |
| `Toggle` | named | Boolean toggle switch with label. |

### Feedback
| Component | Export | Description |
|-----------|--------|-------------|
| `Toast` | named | Individual toast item. Not used directly — use `useToastStore`. |
| `ToastContainer` | named | Place at app root. Renders all active toasts from the store. |
| `useToastStore` | named | Zustand store. `push({ type, message })` to fire a toast from anywhere. |
| `Skeleton` | named | Loading placeholder. Matches the shape of the content it replaces. |

### Charts (recharts wrappers)
| Component | Export | Description |
|-----------|--------|-------------|
| `AreaChart` | named | Recharts AreaChart with theme colors and responsive container. |
| `BarChart` | named | Recharts BarChart with theme colors. |
| `LineChart` | named | Recharts LineChart with theme colors. |
| `DonutChart` | named | Recharts PieChart (donut variant) with theme colors. |

---

## The UITheme Interface

```typescript
// Every consumer defines their theme by implementing this interface.
// Pass it to ThemeProvider — the library writes the CSS vars, components read them.

export interface UITheme {
  bg:        string   // page background
  surface:   string   // card / panel background
  border:    string   // border color
  text:      string   // primary text
  muted:     string   // secondary text / labels
  primary:   string   // primary action color (buttons, focus rings, active states)
  primaryFg: string   // text color on top of primary background
  danger:    string   // destructive actions, error states
  font:      string   // CSS font-family string
  radius:    'sharp' | 'soft' | 'rounded'
}
```

### CSS Custom Properties Written by ThemeProvider

```css
--ui-bg
--ui-surface
--ui-border
--ui-text
--ui-muted
--ui-primary
--ui-primary-fg
--ui-danger
--ui-font
--ui-radius        /* 0px | 6px | 12px */
```

Components use only these vars. Never reference a theme color any other way.

---

## Peer Dependencies

These must be installed by the consumer. They are NOT bundled.

```json
{
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18",
    "recharts": ">=2.0",
    "zustand": ">=4.0",
    "@dnd-kit/core": ">=6.0",
    "@dnd-kit/sortable": ">=7.0",
    "@dnd-kit/utilities": ">=3.0"
  }
}
```

Install in a consuming project:

```bash
npm install @hannasage/projection-ui
npm install recharts zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Consumer Setup

```tsx
// 1. Import tokens (side-effect — writes base CSS vars to :root)
import '@hannasage/projection-ui/tokens'

// 2. Import ThemeProvider and ToastContainer
import { ThemeProvider, ToastContainer } from '@hannasage/projection-ui'

// 3. Define your theme (one per project — store in lib/theme.ts)
import type { UITheme } from '@hannasage/projection-ui'

export const sageTheme: UITheme = {
  bg:        '#070709',
  surface:   '#0e0e12',
  border:    '#1e1e28',
  text:      '#f0f0f4',
  muted:     '#707080',
  primary:   '#7ecba1',   // sage green
  primaryFg: '#070709',
  danger:    '#ff8fa3',
  font:      "'DM Mono', monospace",
  radius:    'soft',
}

// 4. Wrap app root
export default function RootLayout({ children }) {
  return (
    <ThemeProvider theme={sageTheme}>
      <ToastContainer />
      {children}
    </ThemeProvider>
  )
}
```

---

## Theme Overrides Per Project

Each Sage Advice product has its own theme object in `lib/theme.ts`. The library handles the rest.

| Project | Primary Color | Font | Radius |
|---------|---------------|------|--------|
| SageCRM | `#7ecba1` sage green | DM Mono | soft |
| SageSpec | `#8b7fff` iris violet | Syne + DM Mono | soft |
| CarCanvas | (defined in CarCanvas repo) | — | — |
| financial-projections | (original projection-ui colors) | — | — |

---

## Build System

```bash
# Development (Storybook)
npm run storybook        # http://localhost:6006

# Build library (Vite library mode)
npm run build            # outputs to dist/

# Build outputs:
#   dist/index.js        ← ESM
#   dist/index.cjs       ← CommonJS
#   dist/index.d.ts      ← TypeScript declarations
#   dist/style.css       ← compiled token CSS

# Publish to npm
npm publish --access public

# Run tests
npm run test             # vitest

# Lint + type check
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
```

### vite.config.ts (library mode)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true })],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ProjectionUI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'recharts', 'zustand',
                 '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
})
```

---

## Package Exports

```json
{
  "name": "@hannasage/projection-ui",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./tokens": "./dist/style.css"
  },
  "files": ["dist"],
  "sideEffects": ["./dist/style.css"]
}
```

---

## Adding a New Component

Follow this checklist exactly. Every component must pass all steps before merge.

1. **Create `src/components/ComponentName.tsx`**
   - Use only `var(--ui-*)` CSS variables — no raw colors
   - Export a named export (not default)
   - Define a TypeScript interface for all props
   - Include `className?: string` prop for consumer overrides

2. **Add to `src/components/index.ts`** barrel export

3. **Write `stories/ComponentName.stories.tsx`**
   - Minimum: Default story + all variant stories
   - Include the args table (Storybook infers from TypeScript props)

4. **Write `tests/ComponentName.test.tsx`**
   - Render test: renders without error
   - Interaction tests: click, keyboard navigation
   - Accessibility test: `axe` scan returns zero violations
   - Snapshot test (optional, use sparingly)

5. **Run `npm run typecheck && npm run lint && npm run test`** — all must pass

6. **Bump version** in `package.json` (patch for fixes, minor for new components, major for breaking changes)

7. **Update `README.md`** with the new component's API

---

## Graduating a CRM Component to projection-ui

When a component in `components/crm/` of SageCRM (or SageSpec, CarCanvas) is generic enough to be useful outside that project, it should be extracted into this library.

**Criteria for graduation:**
- The component has no domain-specific data dependencies (no Prisma types, no store imports)
- It could be useful in at least two of the four Sage Advice products
- It is styled entirely through `var(--ui-*)` CSS variables

**Process:**
1. Copy the component to `src/components/` in this repo
2. Remove all domain imports — replace with generic prop types
3. Add a Storybook story
4. Add tests (render + axe)
5. Publish new minor version
6. Update the consuming project to import from the library instead

**Candidates from SageCRM currently worth graduating:**
- `TimelineEntry` — activity feed item pattern
- `KanbanBoard` / `KanbanCard` — generic enough for any pipeline UI
- `BriefingCard` — streaming AI response renderer

---

## Accessibility Requirements

Every interactive component must meet WCAG 2.1 AA. This is enforced by axe-core in tests and in the Storybook a11y addon.

- **Contrast ratio:** minimum 4.5:1 for text, 3:1 for large text and UI components
- **Focus management:** all interactive elements are keyboard-reachable and have visible focus indicators using `var(--ui-primary)`
- **Touch targets:** minimum 44×44px on all button/interactive elements
- **ARIA:** all form components have associated labels; modals use `role="dialog"` with `aria-modal="true"`; icon-only buttons have `aria-label`

The `ThemeProvider` enforces contrast compliance on the defined theme object. If a consumer provides a theme that fails contrast checks, a console warning is emitted in development.

---

## Versioning

Follows semver strictly.

- **Patch** `x.x.↑` — bug fixes, documentation updates, internal refactors with no API change
- **Minor** `x.↑.0` — new components, new props on existing components (backward compatible)
- **Major** `↑.0.0` — breaking changes: removed exports, renamed props, changed UITheme interface, changed CSS variable names

**Before publishing any release:**
1. `npm run build` — must succeed
2. `npm run typecheck` — zero errors
3. `npm run test` — all pass
4. Verify `dist/` output contains `index.js`, `index.cjs`, `index.d.ts`, `style.css`
5. Check that peer dependencies are NOT in the bundle: `grep -r "recharts" dist/` should only find import statements, not bundled code

---

## Common Pitfalls

- **Do not** bundle peer dependencies — if recharts or zustand ends up in `dist/index.js`, the consumer will load two copies of the library and break
- **Do not** use hardcoded hex values anywhere in `src/components/` — only `var(--ui-*)` variables
- **Do not** import from consuming projects (SageCRM, SageSpec, etc.) — this library has no knowledge of any product built on it
- **Do not** add routing, data fetching, or server-side logic — this is a pure UI library
- **Do not** add new dependencies to `dependencies` (not `peerDependencies`) without explicit discussion — bundle size is a first-class concern
- **Do not** break the `UITheme` interface without a major version bump — all four consuming projects depend on it
- **Do not** rename or remove CSS custom property names without a major version bump
- **Do not** merge a component without a Storybook story and at least one axe accessibility test
