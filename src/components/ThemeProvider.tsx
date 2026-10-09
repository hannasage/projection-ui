import React from 'react'
import type { UITheme } from '../theme'
import { RADIUS_SCALE, UI_FOUNDATIONS } from '../foundations'

export interface ThemeProviderProps {
  theme:      UITheme
  children:   React.ReactNode
  className?: string
  style?:     React.CSSProperties
  /** Renders as this element. Defaults to 'div'. */
  as?:        React.ElementType
}

export function ThemeProvider({
  theme,
  children,
  className,
  style,
  as: Tag = 'div',
}: ThemeProviderProps): React.ReactElement {
  const r = RADIUS_SCALE[theme.radius]
  const flat = theme.appearance === 'flat'
  const fontOverride = (style as Record<string, unknown> | undefined)?.['--ui-font']

  const vars: React.CSSProperties & Record<string, string> = {
    '--ui-bg':         theme.bg,
    '--ui-surface':    theme.surface,
    '--ui-border':     theme.border,
    '--ui-text':       theme.text,
    '--ui-muted':      theme.muted,
    '--ui-accent-text': theme.mode === 'light' ? theme.text : theme.primary,
    '--ui-primary':    theme.primary,
    '--ui-primary-fg': theme.primaryFg,
    '--ui-danger':     theme.danger,
    '--ui-font':       theme.font,
    '--ui-font-body': fontOverride ? 'var(--ui-font)' : theme.fontBody ?? 'var(--ui-font)',
    '--ui-font-mono': fontOverride ? 'var(--ui-font)' : theme.fontMono ?? 'var(--ui-font)',
    '--ui-partner': theme.partner ?? 'var(--ui-primary)',
    '--ui-accent-end': flat ? theme.primary : (theme.partner ?? theme.primary),
    '--ui-accent-fill': flat ? 'var(--ui-primary)' : 'linear-gradient(110deg, var(--ui-primary), var(--ui-accent-end))',
    '--ui-accent-soft': flat ? 'color-mix(in srgb, var(--ui-primary) 13%, transparent)' : 'linear-gradient(110deg, color-mix(in srgb, var(--ui-primary) 13%, transparent), color-mix(in srgb, var(--ui-accent-end) 13%, transparent))',
    '--ui-surface-tint': flat ? 'none' : 'linear-gradient(125deg, color-mix(in srgb, var(--ui-primary) 1.5%, transparent), color-mix(in srgb, var(--ui-accent-end) 1.5%, transparent))',
    '--ui-field-fill': flat ? 'var(--ui-bg)' : 'linear-gradient(125deg, color-mix(in srgb, var(--ui-primary) 2%, var(--ui-bg)), color-mix(in srgb, var(--ui-accent-end) 2%, var(--ui-bg)))',
    '--ui-glow': theme.glow ?? '0.65',
    '--ui-gradient-start': theme.mode === 'light' ? theme.text : theme.primary,
    '--ui-gradient-end': theme.mode === 'light' ? 'color-mix(in srgb, var(--ui-text) 65%, var(--ui-partner))' : (theme.partner ?? theme.primary),
    '--ui-font-display': fontOverride ? 'var(--ui-font)' : theme.fontDisplay ?? 'var(--ui-font)',
    '--ui-success': theme.success ?? UI_FOUNDATIONS.semantic.success,
    '--ui-warning': theme.warning ?? UI_FOUNDATIONS.semantic.warning,
    '--ui-focus': theme.focus ?? 'var(--ui-primary)',
    '--ui-backdrop': theme.backdrop ?? UI_FOUNDATIONS.semantic.backdrop,
    '--ui-radius-sm':   r.sm,
    '--ui-radius-md':   r.md,
    '--ui-radius-lg':   r.lg,
    '--ui-radius-full': r.full,
  }

  return (
    <Tag
      style={{ ...vars, ...style }}
      className={className}
      data-ui-appearance={theme.appearance}
      data-ui-mode={theme.mode}
      data-ui-radius={theme.radius}
      data-ui-theme=""
    >
      {children}
    </Tag>
  )
}
