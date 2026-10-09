import React, { useId } from 'react'

export interface ToggleProps {
  checked:    boolean
  onChange:   (checked: boolean) => void
  label?:     string
  hint?:      string
  disabled?:  boolean
  size?:      'sm' | 'md'
  className?: string
  'aria-label'?: string
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
  'aria-label': ariaLabel,
}: ToggleProps): React.ReactElement {
  const hintId = useId()
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
        fontFamily: 'var(--ui-font-body, var(--ui-font))',
        ...style,
      }}
    >
      <div className="ui-toggle" style={{ flexShrink: 0, marginTop: 1, position: 'relative' }}>
        <style>{`
          .ui-toggle:has(input:focus-visible) .ui-toggle-track { outline: 2px solid var(--ui-focus, var(--ui-primary)); outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) { .ui-toggle-track, .ui-toggle-thumb { transition: none !important; } }
        `}</style>
        <input
          type="checkbox"
          role="switch"
          aria-label={ariaLabel ?? label}
          aria-describedby={hint ? hintId : undefined}
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', margin: 0, zIndex: 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <div
          className="ui-toggle-track"
          aria-hidden="true"
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
          <div className="ui-toggle-thumb" style={{
            position:     'absolute',
            top:          thumbOff,
            left:         thumbOff,
            transform:    `translateX(${checked ? trackW - thumbSz - 2 * thumbOff : 0}px)`,
            width:        thumbSz,
            height:       thumbSz,
            borderRadius: 'var(--ui-radius-full)',
            background:   checked ? 'var(--ui-primary-fg)' : 'var(--ui-muted)',
            transition:   'transform 0.18s, background 0.18s',
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
            <span id={hintId} style={{ fontSize: 11, color: 'var(--ui-muted)', lineHeight: 1.4 }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </label>
  )
}
