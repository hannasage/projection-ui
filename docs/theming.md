# Themes and tokens

`ThemeProvider` applies a `UITheme` object as CSS variables on its wrapper element.
Child components read those values.
A nested provider can give one part of a page its own theme.

For new integrations, import `/styles` to scope shared component rules to theme wrappers.
Import `/reset` only when your application needs explicit page rules.
The legacy `/tokens` entry retains global focus, form, scrollbar, and selection rules.

## Theme fields

The existing fields below remain required.
The 0.2 candidate adds optional fields without changing existing theme objects.
The palette below comes from `DEFAULT_THEME` and the generated token stylesheet.

| Field | CSS variable | Fallback |
| --- | --- | --- |
| `bg` | `--ui-bg` | `#07090C` |
| `surface` | `--ui-surface` | `#0D1117` |
| `border` | `--ui-border` | `#1B2535` |
| `text` | `--ui-text` | `#DDE3EE` |
| `muted` | `--ui-muted` | `#8396AB` |
| `primary` | `--ui-primary` | `#C9F53A` |
| `primaryFg` | `--ui-primary-fg` | `#07090C` |
| `danger` | `--ui-danger` | `#FF5252` |
| `font` | `--ui-font` | `'IBM Plex Mono', monospace` |
| `radius` | The four radius variables below | `soft` |

The package does not load a font file.
Your application can supply its own font family and font assets.
The provider does not apply a page background or body text color by itself.
Use its `style` prop or your application's CSS for those properties.

## Radius presets

`RADIUS_SCALE` defines four values per preset.
Different components use different radius roles.

| Preset | `sm` | `md` | `lg` | `full` |
| --- | --- | --- | --- | --- |
| `sharp` | `0px` | `2px` | `4px` | `4px` |
| `soft` | `4px` | `6px` | `10px` | `9999px` |
| `rounded` | `10px` | `16px` | `24px` | `9999px` |

The variable names are `--ui-radius-sm`, `--ui-radius-md`, `--ui-radius-lg`, and `--ui-radius-full`.
Button and form fields use `md`. Card uses `lg`. Badge uses `sm`.

## Override a value

`ThemeProvider` accepts `theme`, `children`, `className`, `style`, and `as`.
The default wrapper is a `div`.
The `style` prop takes priority over generated values.

```tsx
import { ThemeProvider } from '@hannasage/projection-ui'
import type { CSSProperties } from 'react'
import type { UITheme } from '@hannasage/projection-ui'

export function CompactPanel({ theme }: { theme: UITheme }) {
  const style = { '--ui-radius-md': '4px' } as CSSProperties
  return <ThemeProvider theme={theme} style={style}>Panel content</ThemeProvider>
}
```

Use the application's theme state to pass a different `UITheme` object.
The library does not ship a theme picker, a persistence mechanism, or a light palette preset.
Test text, focus, and control contrast for each palette that your application offers.

## Optional semantic and font roles

| Field | CSS variable | Default |
| --- | --- | --- |
| `fontBody` | `--ui-font-body` | Existing `font` value |
| `fontDisplay` | `--ui-font-display` | Existing `font` value |
| `success` | `--ui-success` | `#51CF66` |
| `warning` | `--ui-warning` | `#FFB347` |
| `focus` | `--ui-focus` | Existing `primary` value |
| `backdrop` | `--ui-backdrop` | `rgba(0,0,0,0.55)` |

`DEFAULT_THEME` supplies the existing theme fields.
`UI_FOUNDATIONS` supplies type, line-height, spacing, border, elevation, motion, and semantic values.
The generated CSS properties use the same foundation source.
The [token preview](pages/Tokens.mdx) reads the actual package exports.
