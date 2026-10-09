import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  /** Renders full-width */
  block?:    boolean
  appearance?: 'solid' | 'gradient'
}

const SIZE: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 12px',  fontSize: 11 },
  md: { padding: '8px 16px',  fontSize: 12 },
  lg: { padding: '11px 22px', fontSize: 14 },
}

const BASE: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            6,
  border:         'none',
  borderRadius:   'var(--ui-radius-md)',
  fontFamily:     'var(--ui-font-body, var(--ui-font))',
  fontWeight:     500,
  cursor:         'pointer',
  lineHeight:     1,
  transition:     'background-color 0.12s, color 0.12s, opacity 0.12s',
  textDecoration: 'none',
  whiteSpace:     'nowrap',
}

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--ui-primary)',
    color:      'var(--ui-primary-fg)',
    border:     '1px solid var(--ui-primary)',
  },
  secondary: {
    background: 'transparent',
    color:      'var(--ui-muted)',
    border:     '1px solid var(--ui-border)',
  },
  ghost: {
    background: 'transparent',
    color:      'var(--ui-muted)',
    border:     '1px solid transparent',
  },
  danger: {
    background: 'transparent',
    color:      'var(--ui-danger-text, var(--ui-danger))',
    border:     '1px solid var(--ui-danger)',
  },
  /** Rounded icon button — no text label, minimal chrome. */
  icon: {
    background:   'transparent',
    color:        'var(--ui-muted)',
    border:       '1px solid transparent',
    borderRadius: 'var(--ui-radius-full)',
    padding:      '8px',
  },
}

export function Button({
  variant = 'secondary',
  size    = 'md',
  block   = false,
  appearance = 'gradient',
  className,
  style,
  disabled,
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  return (
    <button
      {...rest}
      className={['ui-button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-appearance={appearance}
      disabled={disabled}
      style={{
        ...BASE,
        ...(variant === 'icon' ? VARIANT_STYLE.icon : SIZE[size]),
        ...(variant !== 'icon' ? VARIANT_STYLE[variant] : {}),
        background: variant === 'primary' && appearance === 'gradient' ? undefined : VARIANT_STYLE[variant].background,
        width:   block ? '100%' : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor:  disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
