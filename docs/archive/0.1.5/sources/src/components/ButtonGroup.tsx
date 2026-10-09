import React from 'react'

export interface ButtonGroupOption<T extends string = string> {
  value:     T
  label:     React.ReactNode
  title?:    string
  disabled?: boolean
}

export interface ButtonGroupProps<T extends string = string> {
  options:      ButtonGroupOption<T>[]
  value:        T | null
  onChange:     (value: T) => void
  /**
   * chip (default) — individual floating pills with gaps, each with its own
   * border that activates on selection. Matches the brand's original chip style.
   *
   * segmented — joined control with shared outer border (iOS-style). Use for
   * binary mode toggles where the options are part of a unified whole.
   */
  variant?:     'chip' | 'segmented'
  deselectable?: boolean
  size?:        'sm' | 'md' | 'lg'
  /** Full-width equal-width options (segmented only — chips wrap naturally) */
  block?:       boolean
  className?:   string
  style?:       React.CSSProperties
}

const SIZE: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
  sm: { padding: '4px 10px',  fontSize: 11 },
  md: { padding: '6px 14px',  fontSize: 12 },
  lg: { padding: '9px 20px',  fontSize: 13 },
}

export function ButtonGroup<T extends string = string>({
  options,
  value,
  onChange,
  variant      = 'chip',
  deselectable = false,
  size         = 'md',
  block        = false,
  className,
  style,
}: ButtonGroupProps<T>): React.ReactElement {
  const handleClick = (opt: ButtonGroupOption<T>) => {
    if (opt.disabled) return
    if (deselectable && opt.value === value) {
      onChange('' as T)
    } else if (opt.value !== value) {
      onChange(opt.value)
    }
  }

  if (variant === 'segmented') {
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
          const isActive = opt.value === value
          const isFirst  = idx === 0
          const isLast   = idx === options.length - 1
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={isActive}
              title={opt.title}
              disabled={opt.disabled}
              onClick={() => handleClick(opt)}
              style={{
                ...SIZE[size],
                flex:           block ? 1 : undefined,
                fontFamily:     'var(--ui-font)',
                fontWeight:     isActive ? 600 : 400,
                background:     isActive
                  ? 'color-mix(in srgb, var(--ui-primary) 13%, transparent)'
                  : 'transparent',
                color:          isActive ? 'var(--ui-primary)' : 'var(--ui-muted)',
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

  // chip variant — individual floating pills with gaps (the brand default)
  return (
    <div
      role="group"
      className={className}
      style={{
        display:   'flex',
        gap:       6,
        flexWrap:  block ? 'nowrap' : 'wrap',
        width:     block ? '100%' : undefined,
        ...style,
      }}
    >
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            title={opt.title}
            disabled={opt.disabled}
            onClick={() => handleClick(opt)}
            style={{
              ...SIZE[size],
              flex:           block ? 1 : undefined,
              fontFamily:     'var(--ui-font)',
              fontWeight:     isActive ? 600 : 400,
              background:     isActive
                ? 'color-mix(in srgb, var(--ui-primary) 13%, transparent)'
                : 'transparent',
              color:          isActive ? 'var(--ui-primary)' : 'var(--ui-muted)',
              border:         isActive
                ? '1px solid var(--ui-primary)'
                : '1px solid var(--ui-border)',
              borderRadius:   'var(--ui-radius-md)',
              cursor:         opt.disabled ? 'not-allowed' : 'pointer',
              opacity:        opt.disabled ? 0.45 : 1,
              whiteSpace:     'nowrap',
              lineHeight:     1,
              transition:     'all 0.12s',
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
