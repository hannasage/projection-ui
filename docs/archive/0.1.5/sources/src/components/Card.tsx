import React from 'react'

export interface CardProps {
  children:   React.ReactNode
  /** Extra padding variant. Defaults to 'md'. */
  padding?:   'none' | 'sm' | 'md' | 'lg'
  /** Visual border style. Defaults to 'default'. */
  border?:    'default' | 'subtle' | 'accent' | 'none'
  className?: string
  style?:     React.CSSProperties
  as?:        React.ElementType
}

const PAD: Record<NonNullable<CardProps['padding']>, string> = {
  none: '0',
  sm:   '12px',
  md:   '18px 20px',
  lg:   '24px 28px',
}

const BORDER_STYLE: Record<NonNullable<CardProps['border']>, React.CSSProperties> = {
  default: { border: '1px solid var(--ui-border)' },
  subtle:  { border: '1px solid color-mix(in srgb, var(--ui-border) 50%, transparent)' },
  accent:  { border: '1px solid var(--ui-primary)' },
  none:    { border: 'none' },
}

export function Card({
  children,
  padding   = 'md',
  border    = 'default',
  className,
  style,
  as: Tag   = 'div',
}: CardProps): React.ReactElement {
  return (
    <Tag
      className={className}
      style={{
        background:   'var(--ui-surface)',
        borderRadius: 'var(--ui-radius-lg)',
        padding:      PAD[padding],
        fontFamily:   'var(--ui-font)',
        ...BORDER_STYLE[border],
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
