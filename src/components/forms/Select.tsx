import React from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string
  error?:   string
  hint?:    string
  options:  SelectOption[]
  /** Placeholder option shown when no value is selected */
  placeholder?: string
  containerStyle?: React.CSSProperties
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  containerStyle,
  style,
  id,
  ...rest
}: SelectProps): React.ReactElement {
  const selectId = id ?? (label ? `ui-select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...containerStyle }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{ fontSize: 11, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)', letterSpacing: 0.5 }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={selectId}
          {...rest}
          style={{
            width:        '100%',
            padding:      '8px 30px 8px 10px',
            fontSize:     13,
            fontFamily:   'var(--ui-font)',
            color:        'var(--ui-text)',
            background:   'var(--ui-surface)',
            border:       `1px solid ${error ? 'var(--ui-danger)' : 'var(--ui-border)'}`,
            borderRadius: 'var(--ui-radius-md)',
            outline:      'none',
            appearance:   'none',
            WebkitAppearance: 'none',
            cursor:       'pointer',
            boxSizing:    'border-box',
            ...style,
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <span style={{
          position:      'absolute',
          right:         10,
          top:           '50%',
          transform:     'translateY(-50%)',
          pointerEvents: 'none',
          color:         'var(--ui-muted)',
          fontSize:      10,
        }}>
          ▾
        </span>
      </div>
      {error && (
        <span style={{ fontSize: 11, color: 'var(--ui-danger)', fontFamily: 'var(--ui-font)' }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span style={{ fontSize: 11, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}
