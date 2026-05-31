import React from 'react'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?:          string
  error?:          string
  hint?:           string
  /** Slot for an icon/adornment on the left */
  prefix?:         React.ReactNode
  /** Slot for an icon/adornment on the right */
  suffix?:         React.ReactNode
  containerStyle?: React.CSSProperties
}

const fieldBase: React.CSSProperties = {
  width:        '100%',
  padding:      '7px 10px',
  fontSize:     12,
  fontFamily:   'var(--ui-font)',
  color:        'var(--ui-text)',
  background:   'var(--ui-bg)',
  border:       '1px solid var(--ui-border)',
  borderRadius: 'var(--ui-radius-md)',
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 0.12s',
}

const labelStyle: React.CSSProperties = {
  fontSize:      10,
  color:         'var(--ui-muted)',
  fontFamily:    'var(--ui-font)',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
}

export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  containerStyle,
  style,
  id,
  ...rest
}: InputProps): React.ReactElement {
  const inputId = id ?? (label ? `ui-input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...containerStyle }}>
      {label && (
        <label htmlFor={inputId} style={labelStyle}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && (
          <span style={{
            position:      'absolute',
            left:          10,
            color:         'var(--ui-muted)',
            fontSize:      11,
            display:       'flex',
            alignItems:    'center',
            pointerEvents: 'none',
            userSelect:    'none',
          }}>
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          {...rest}
          style={{
            ...fieldBase,
            paddingLeft:  prefix ? 28 : undefined,
            paddingRight: suffix ? 36 : undefined,
            borderColor:  error ? 'var(--ui-danger)' : undefined,
            ...style,
          }}
        />
        {suffix && (
          <span style={{
            position:      'absolute',
            right:         10,
            color:         'var(--ui-muted)',
            fontSize:      11,
            display:       'flex',
            alignItems:    'center',
            pointerEvents: 'none',
            userSelect:    'none',
          }}>
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 10, color: 'var(--ui-danger)', fontFamily: 'var(--ui-font)', letterSpacing: '0.5px' }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span style={{ fontSize: 10, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}
