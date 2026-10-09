import React, { useId } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:          string
  error?:          string
  hint?:           string
  containerStyle?: React.CSSProperties
}

const labelStyle: React.CSSProperties = {
  fontSize:      10,
  color:         'var(--ui-muted)',
  fontFamily:    'var(--ui-font-mono, var(--ui-font))',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
}

export function Textarea({
  label,
  error,
  hint,
  containerStyle,
  style,
  className,
  id,
  ...rest
}: TextareaProps): React.ReactElement {
  const generatedId = useId()
  const textareaId = id ?? `ui-textarea-${generatedId}`
  const descriptionId = error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
  const describedBy = [rest['aria-describedby'], descriptionId].filter(Boolean).join(' ') || undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...containerStyle }}>
      {label && (
        <label htmlFor={textareaId} style={labelStyle}>
          {label}
        </label>
      )}
      <textarea
          className={['ui-field', className].filter(Boolean).join(' ')}
        id={textareaId}
        {...rest}
        aria-describedby={describedBy}
        aria-invalid={error ? true : rest['aria-invalid']}
        style={{
          width:        '100%',
          paddingTop:    7,
          paddingBottom: 7,
          paddingLeft:   10,
          paddingRight:  10,
          fontSize:     12,
          fontFamily:   'var(--ui-font-body, var(--ui-font))',
          color:        'var(--ui-text)',
          background:   'var(--ui-bg)',
          border:       `1px solid ${error ? 'var(--ui-danger)' : 'var(--ui-border)'}`,
          borderRadius: 'var(--ui-radius-md)',
          resize:       'vertical',
          minHeight:    80,
          boxSizing:    'border-box',
          lineHeight:   1.5,
          transition:   'border-color 0.12s',
          ...style,
        }}
      />
      {error && (
        <span id={descriptionId} style={{ fontSize: 10, color: 'var(--ui-danger)', fontFamily: 'var(--ui-font-body, var(--ui-font))', letterSpacing: '0.5px' }}>
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
