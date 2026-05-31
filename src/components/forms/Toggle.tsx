import React from 'react'

export interface ToggleProps {
  checked:    boolean
  onChange:   (checked: boolean) => void
  label?:     string
  hint?:      string
  disabled?:  boolean
  size?:      'sm' | 'md'
  className?: string
  style?:     React.CSSProperties
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  size     = 'md',
  className,
  style,
}: ToggleProps): React.ReactElement {
  const trackW  = size === 'sm' ? 30 : 38
  const trackH  = size === 'sm' ? 17 : 22
  const thumbSz = size === 'sm' ? 11 : 16
  const thumbOff = size === 'sm' ? 3  : 3

  return (
    <label
      className={className}
      style={{
        display:    'inline-flex',
        alignItems: 'flex-start',
        gap:        10,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled ? 0.45 : 1,
        fontFamily: 'var(--ui-font)',
        ...style,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div
          role="switch"
          aria-checked={checked}
          onClick={() => !disabled && onChange(!checked)}
          style={{
            width:        trackW,
            height:       trackH,
            borderRadius: 'var(--ui-radius-full)',
            background:   checked ? 'var(--ui-primary)' : 'var(--ui-border)',
            position:     'relative',
            transition:   'background 0.18s',
            flexShrink:   0,
          }}
        >
          <div style={{
            position:     'absolute',
            top:          thumbOff,
            left:         checked ? trackW - thumbSz - thumbOff : thumbOff,
            width:        thumbSz,
            height:       thumbSz,
            borderRadius: 'var(--ui-radius-full)',
            background:   checked ? 'var(--ui-primary-fg)' : 'var(--ui-muted)',
            transition:   'left 0.18s, background 0.18s',
          }} />
        </div>
      </div>
      {(label || hint) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {label && (
            <span style={{ fontSize: 13, color: 'var(--ui-text)', lineHeight: 1.3 }}>
              {label}
            </span>
          )}
          {hint && (
            <span style={{ fontSize: 11, color: 'var(--ui-muted)', lineHeight: 1.4 }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </label>
  )
}
