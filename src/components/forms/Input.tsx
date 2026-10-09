import React, { useId } from 'react'

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
  width:         '100%',
  paddingTop:    7,
  paddingBottom: 7,
  paddingLeft:   10,
  paddingRight:  10,
  fontSize:      12,
  fontFamily:    'var(--ui-font-body, var(--ui-font))',
  color:         'var(--ui-text)',
  background:    'var(--ui-field-fill, var(--ui-bg))',
  border:        '1px solid var(--ui-border)',
  borderRadius:  'var(--ui-radius-md)',
  boxSizing:     'border-box',
  transition:    'border-color 0.12s',
}

const labelStyle: React.CSSProperties = {
  fontSize:      10,
  color:         'var(--ui-muted)',
  fontFamily:    'var(--ui-font-mono, var(--ui-font))',
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
  className,
  id,
  ...rest
}: InputProps): React.ReactElement {
  const generatedId = useId()
  const inputId = id ?? `ui-input-${generatedId}`
  const descriptionId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  const describedBy = [rest['aria-describedby'], descriptionId].filter(Boolean).join(' ') || undefined

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
          className={['ui-field', className].filter(Boolean).join(' ')}
          id={inputId}
          {...rest}
          aria-describedby={describedBy}
          aria-invalid={error ? true : rest['aria-invalid']}
          style={{
            ...fieldBase,
            paddingLeft:  prefix ? 26 : 10,
            paddingRight: suffix ? 34 : 10,
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
        <span id={descriptionId} style={{ fontSize: 10, color: 'var(--ui-danger-text, var(--ui-danger))', fontFamily: 'var(--ui-font-body, var(--ui-font))', letterSpacing: '0.5px' }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={descriptionId} style={{ fontSize: 10, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font-body, var(--ui-font))' }}>
          {hint}
        </span>
      )}
    </div>
  )
}
