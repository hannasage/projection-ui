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

  const vars: React.CSSProperties & Record<string, string> = {
    '--ui-bg':         theme.bg,
    '--ui-surface':    theme.surface,
    '--ui-border':     theme.border,
    '--ui-text':       theme.text,
    '--ui-muted':      theme.muted,
    '--ui-primary':    theme.primary,
    '--ui-primary-fg': theme.primaryFg,
    '--ui-danger':     theme.danger,
    '--ui-font':       theme.font,
    '--ui-font-body': theme.fontBody ?? 'var(--ui-font)',
    '--ui-font-display': theme.fontDisplay ?? 'var(--ui-font)',
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
      data-ui-radius={theme.radius}
      data-ui-theme=""
    >
      {children}
    </Tag>
  )
}
