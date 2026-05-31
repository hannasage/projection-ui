import React from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:   string
  error?:   string
  hint?:    string
  containerStyle?: React.CSSProperties
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
        <label
          htmlFor={textareaId}
          style={{ fontSize: 11, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)', letterSpacing: 0.5 }}
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        {...rest}
        style={{
          width:        '100%',
          padding:      '8px 10px',
          fontSize:     13,
          fontFamily:   'var(--ui-font)',
          color:        'var(--ui-text)',
          background:   'transparent',
          border:       `1px solid ${error ? 'var(--ui-danger)' : 'var(--ui-border)'}`,
          borderRadius: 'var(--ui-radius-md)',
          outline:      'none',
          resize:       'vertical',
          minHeight:    80,
          boxSizing:    'border-box',
          lineHeight:   1.5,
          ...style,
        }}
      />
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
