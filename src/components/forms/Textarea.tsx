import React from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:          string
  error?:          string
  hint?:           string
  containerStyle?: React.CSSProperties
}

const labelStyle: React.CSSProperties = {
  fontSize:      10,
  color:         'var(--ui-muted)',
  fontFamily:    'var(--ui-font)',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
}

export function Textarea({
  label,
  error,
  hint,
  containerStyle,
  style,
  id,
  ...rest
}: TextareaProps): React.ReactElement {
  const textareaId = id ?? (label ? `ui-textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...containerStyle }}>
      {label && (
        <label htmlFor={textareaId} style={labelStyle}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        {...rest}
        style={{
          width:        '100%',
          padding:      '7px 10px',
          fontSize:     12,
          fontFamily:   'var(--ui-font)',
          color:        'var(--ui-text)',
          background:   'var(--ui-bg)',
          border:       `1px solid ${error ? 'var(--ui-danger)' : 'var(--ui-border)'}`,
          borderRadius: 'var(--ui-radius-md)',
          outline:      'none',
          resize:       'vertical',
          minHeight:    80,
          boxSizing:    'border-box',
          lineHeight:   1.5,
          transition:   'border-color 0.12s',
          ...style,
        }}
      />
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
