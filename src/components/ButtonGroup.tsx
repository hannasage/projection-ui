import React from 'react'

export interface ButtonGroupOption<T extends string = string> {
  value:     T
  label:     React.ReactNode
  /** Shown in a tooltip on hover */
  title?:    string
  disabled?: boolean
}

export interface ButtonGroupProps<T extends string = string> {
  options:    ButtonGroupOption<T>[]
  value:      T | null
  onChange:   (value: T) => void
  /** Allow deselecting the active option by clicking it again */
  deselectable?: boolean
  size?:      'sm' | 'md' | 'lg'
  /** Fill the full width, options share space equally */
  block?:     boolean
  className?: string
  style?:     React.CSSProperties
}

const SIZE_STYLE: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
  sm: { padding: '4px 10px',  fontSize: 11 },
  md: { padding: '7px 14px',  fontSize: 12 },
  lg: { padding: '10px 18px', fontSize: 14 },
}

export function ButtonGroup<T extends string = string>({
  options,
  value,
  onChange,
  deselectable = false,
  size         = 'md',
  block        = false,
  className,
  style,
}: ButtonGroupProps<T>): React.ReactElement {
  return (
    <div
      role="group"
      className={className}
      style={{
        display:      'inline-flex',
        borderRadius: 'var(--ui-radius-md)',
        border:       '1px solid var(--ui-border)',
        overflow:     'hidden',
        width:        block ? '100%' : undefined,
        ...style,
      }}
    >
      {options.map((opt, idx) => {
        const isActive   = opt.value === value
        const isFirst    = idx === 0
        const isLast     = idx === options.length - 1

        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            title={opt.title}
            disabled={opt.disabled}
            onClick={() => {
              if (deselectable && isActive) {
                onChange('' as T)
              } else if (!isActive) {
                onChange(opt.value)
              }
            }}
            style={{
              ...SIZE_STYLE[size],
              flex:           block ? 1 : undefined,
              fontFamily:     'var(--ui-font)',
              fontWeight:     isActive ? 600 : 400,
              background:     isActive ? 'var(--ui-primary)' : 'transparent',
              color:          isActive ? 'var(--ui-primary-fg)' : 'var(--ui-muted)',
              border:         'none',
              borderLeft:     isFirst ? 'none' : '1px solid var(--ui-border)',
              borderRadius:   isFirst
                ? 'calc(var(--ui-radius-md) - 1px) 0 0 calc(var(--ui-radius-md) - 1px)'
                : isLast
                  ? '0 calc(var(--ui-radius-md) - 1px) calc(var(--ui-radius-md) - 1px) 0'
                  : '0',
              cursor:         opt.disabled ? 'not-allowed' : 'pointer',
              opacity:        opt.disabled ? 0.45 : 1,
              whiteSpace:     'nowrap',
              lineHeight:     1,
              transition:     'background 0.12s, color 0.12s',
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            5,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
