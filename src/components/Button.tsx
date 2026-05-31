import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  /** Renders full-width */
  block?:    boolean
}

const SIZE: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 12px',  fontSize: 12 },
  md: { padding: '8px 16px',  fontSize: 13 },
  lg: { padding: '11px 22px', fontSize: 15 },
}

const BASE: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            6,
  border:         'none',
  borderRadius:   'var(--ui-radius-md)',
  fontFamily:     'var(--ui-font)',
  fontWeight:     500,
  cursor:         'pointer',
  lineHeight:     1,
  transition:     'opacity 0.12s, background 0.12s',
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
    color:      'var(--ui-text)',
    border:     '1px solid var(--ui-border)',
  },
  ghost: {
    background: 'transparent',
    color:      'var(--ui-muted)',
    border:     '1px solid transparent',
  },
  danger: {
    background: 'transparent',
    color:      'var(--ui-danger)',
    border:     '1px solid var(--ui-danger)',
  },
}

export function Button({
  variant = 'secondary',
  size    = 'md',
  block   = false,
  style,
  disabled,
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...BASE,
        ...SIZE[size],
        ...VARIANT_STYLE[variant],
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
