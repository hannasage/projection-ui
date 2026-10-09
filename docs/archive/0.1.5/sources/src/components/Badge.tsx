import React from 'react'

export interface BadgeProps {
  children:    React.ReactNode
  /** Accent-colored dot prefix. Defaults to true. */
  dot?:        boolean
  /** Override the dot color. Defaults to --ui-primary. */
  dotColor?:   string
  /** Pill fills with a tinted background instead of transparent. */
  filled?:     boolean
  className?:  string
  style?:      React.CSSProperties
}

export function Badge({
  children,
  dot      = true,
  dotColor,
  filled   = false,
  className,
  style,
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={className}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           5,
        padding:       '3px 8px',
        borderRadius:  'var(--ui-radius-sm)',
        border:        '1px solid var(--ui-border)',
        background:    filled
          ? 'color-mix(in srgb, var(--ui-primary) 10%, transparent)'
          : 'var(--ui-bg)',
        color:         'var(--ui-muted)',
        fontFamily:    'var(--ui-font)',
        fontSize:      10,
        fontWeight:    500,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        lineHeight:    1,
        whiteSpace:    'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            display:      'inline-block',
            width:        5,
            height:       5,
            borderRadius: '50%',
            background:   dotColor ?? 'var(--ui-primary)',
            flexShrink:   0,
          }}
        />
      )}
      {children}
    </span>
  )
}
