import React, { useRef } from 'react'
import { useMergedRef, useMotionRuntime, usePressMotion } from './motionContext'
import { MotionStyle } from './motionStyle'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  /** Renders full-width */
  block?:    boolean
  appearance?: 'solid' | 'gradient'
  /** The button element. React 19 passes `ref` as a prop, and Button forwards it with or without a MotionProvider. */
  ref?:      React.Ref<HTMLButtonElement>
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
  ref: passedRef,
  ...rest
}: ButtonProps): React.ReactElement {
  // With a MotionProvider, a pointer press springs the scale (D12 A: small and fast). Keyboard activation gets no motion.
  const runtime = useMotionRuntime()
  const own = useRef<HTMLButtonElement | null>(null)
  const ref = useMergedRef(own, passedRef)
  usePressMotion(own, runtime, !disabled)
  const button = (
    <button
      {...rest}
      ref={runtime ? ref : passedRef}
      className={['ui-button', className].filter(Boolean).join(' ')}
      data-pui-motion={runtime ? 'press' : undefined}
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
        ...(runtime ? { scale: 'var(--pui-press, 1)', transition: 'background-color var(--ui-motion-fast, 0.12s), color var(--ui-motion-fast, 0.12s), opacity var(--ui-motion-fast, 0.12s)' } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  )
  // React hoists the shared motion stylesheet into the head, so the button stays the only element rendered here.
  return runtime ? <><MotionStyle />{button}</> : button
}
