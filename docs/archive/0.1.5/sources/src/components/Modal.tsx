import React, { useEffect, useRef } from 'react'

export interface ModalAction {
  label:      string
  onClick?:   () => void
  href?:      string
  target?:    '_blank' | '_self'
  variant?:   'primary' | 'secondary' | 'danger'
  ariaLabel?: string
  disabled?:  boolean
}

export interface ModalProps {
  open:       boolean
  title:      string
  children:   React.ReactNode
  actions?:   ModalAction[]
  onDismiss:  () => void
  /** Max width of the dialog. Defaults to 440. */
  maxWidth?:  number
  className?: string
}

export function Modal({
  open,
  title,
  children,
  actions = [],
  onDismiss,
  maxWidth = 440,
  className,
}: ModalProps): React.ReactElement | null {
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  const headingId  = 'ui-modal-title'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onDismiss() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onDismiss])

  useEffect(() => {
    if (open) requestAnimationFrame(() => primaryRef.current?.focus())
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onDismiss}
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.55)',
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={className}
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   'var(--ui-surface)',
          border:       '1px solid var(--ui-border)',
          borderRadius: 'var(--ui-radius-lg)',
          boxShadow:    '0 24px 80px rgba(0,0,0,0.45)',
          maxWidth,
          width:        '100%',
          maxHeight:    '90vh',
          overflowY:    'auto',
          fontFamily:   'var(--ui-font)',
          color:        'var(--ui-text)',
        }}
      >
        <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2
            id={headingId}
            style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.25, color: 'var(--ui-text)' }}
          >
            {title}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--ui-muted)', lineHeight: 1.55 }}>
            {children}
          </div>
        </div>

        {actions.length > 0 && (
          <div style={{
            padding:         '16px 20px 18px',
            marginTop:       14,
            borderTop:       '1px solid var(--ui-border)',
            display:         'flex',
            justifyContent:  'flex-end',
            gap:             8,
            flexWrap:        'wrap',
          }}>
            {actions.map((a, idx) => {
              const isPrimary = a.variant === 'primary' || (a.variant === undefined && idx === actions.length - 1)
              const isDanger  = a.variant === 'danger'

              const btnStyle: React.CSSProperties = {
                padding:        '8px 18px',
                fontSize:       13,
                borderRadius:   'var(--ui-radius-md)',
                fontFamily:     'var(--ui-font)',
                cursor:         a.disabled ? 'not-allowed' : 'pointer',
                fontWeight:     isPrimary ? 600 : 500,
                border:         isPrimary ? '1px solid var(--ui-primary)'
                              : isDanger  ? '1px solid var(--ui-danger)'
                              :             '1px solid var(--ui-border)',
                background:     isPrimary ? 'var(--ui-primary)'
                              : isDanger  ? 'transparent'
                              :             'transparent',
                color:          isPrimary ? 'var(--ui-primary-fg)'
                              : isDanger  ? 'var(--ui-danger)'
                              :             'var(--ui-muted)',
                opacity:        a.disabled ? 0.45 : 1,
                textDecoration: 'none',
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
              }

              if (a.href) {
                return (
                  <a
                    key={a.label}
                    href={a.href}
                    target={a.target ?? '_self'}
                    rel={a.target === '_blank' ? 'noopener noreferrer' : undefined}
                    aria-label={a.ariaLabel ?? a.label}
                    onClick={a.onClick}
                    style={btnStyle}
                  >
                    {a.label}
                  </a>
                )
              }

              return (
                <button
                  key={a.label}
                  ref={isPrimary ? primaryRef : undefined}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  aria-label={a.ariaLabel ?? a.label}
                  style={btnStyle}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
