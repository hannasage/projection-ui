import React, { useEffect, useId, useRef } from 'react'

const documents = new WeakMap<Document, { stack: HTMLElement[]; overflow: string }>()
const focusable = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'))
  .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')

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
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const dismissRef = useRef(onDismiss)
  const headingId = useId()
  useEffect(() => { dismissRef.current = onDismiss }, [onDismiss])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const owner = dialog.ownerDocument
    const opener = owner.activeElement instanceof HTMLElement ? owner.activeElement : null
    let state = documents.get(owner)
    if (!state) { state = { stack: [], overflow: owner.body.style.overflow }; documents.set(owner, state) }
    const nestedIndex = state.stack.findIndex(item => dialog.contains(item))
    if (nestedIndex >= 0) state.stack.splice(nestedIndex, 0, dialog)
    else state.stack.push(dialog)
    owner.body.style.overflow = 'hidden'
    const topmost = () => state.stack[state.stack.length - 1] === dialog
    const initial = () => {
      const items = focusable(dialog)
      const primary = items.find(item => item.hasAttribute('data-ui-modal-primary'))
      ;(primary ?? items[0] ?? dialog).focus()
    }
    if (topmost()) initial()
    const handler = (event: KeyboardEvent) => {
      if (!topmost()) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); dismissRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable(dialog)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && (owner.activeElement === first || !items.includes(owner.activeElement as HTMLElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (owner.activeElement === last || !items.includes(owner.activeElement as HTMLElement))) { event.preventDefault(); first.focus() }
    }
    const containFocus = (event: FocusEvent) => {
      if (topmost() && !dialog.contains(event.target as Node)) initial()
    }
    owner.addEventListener('keydown', handler)
    owner.addEventListener('focusin', containFocus)
    return () => {
      owner.removeEventListener('keydown', handler)
      owner.removeEventListener('focusin', containFocus)
      const wasTopmost = topmost()
      state.stack.splice(state.stack.indexOf(dialog), 1)
      if (state.stack.length === 0) { owner.body.style.overflow = state.overflow; documents.delete(owner) }
      if (wasTopmost && opener?.isConnected) opener.focus()
      else if (wasTopmost && state.stack.length) (focusable(state.stack[state.stack.length - 1])[0] ?? state.stack[state.stack.length - 1]).focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onDismiss}
      style={{
        position:        'fixed',
        inset:           0,
        background:      'var(--ui-backdrop, rgba(0,0,0,0.55))',
        zIndex:          1000,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         16,
      }}
    >
      <div
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={headingId}
        className={['ui-surface', className].filter(Boolean).join(' ')}
        data-material="glass"
        data-edge-light
        data-underglow
        onClick={(e) => e.stopPropagation()}
        style={{
          border:       '1px solid var(--ui-border)',
          borderRadius: 'var(--ui-radius-lg)',
          boxShadow:    '0 24px 80px rgba(0,0,0,0.45)',
          maxWidth,
          width:        '100%',
          maxHeight:    '90vh',
          overflowY:    'auto',
          fontFamily:   'var(--ui-font-body, var(--ui-font))',
          color:        'var(--ui-text)',
        }}
      >
        <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2
            id={headingId}
            style={{ fontFamily: 'var(--ui-font-display, var(--ui-font))', fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.25, color: 'var(--ui-text)' }}
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
                fontFamily:     'var(--ui-font-body, var(--ui-font))',
                cursor:         a.disabled ? 'not-allowed' : 'pointer',
                fontWeight:     isPrimary ? 600 : 500,
                border:         isPrimary ? '1px solid var(--ui-primary)'
                              : isDanger  ? '1px solid var(--ui-danger)'
                              :             '1px solid var(--ui-border)',
                background:     isPrimary ? 'var(--ui-primary)'
                              : isDanger  ? 'transparent'
                              :             'transparent',
                color:          isPrimary ? 'var(--ui-primary-fg)'
                              : isDanger  ? 'var(--ui-danger-text, var(--ui-danger))'
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
                    href={a.disabled ? undefined : a.href}
                    target={a.target ?? '_self'}
                    rel={a.target === '_blank' ? 'noopener noreferrer' : undefined}
                    aria-label={a.ariaLabel ?? a.label}
                    aria-disabled={a.disabled || undefined}
                    tabIndex={a.disabled ? -1 : undefined}
                    data-ui-modal-primary={isPrimary ? '' : undefined}
                    onClick={event => { if (a.disabled) event.preventDefault(); else a.onClick?.() }}
                    style={btnStyle}
                  >
                    {a.label}
                  </a>
                )
              }

              return (
                <button
                  key={a.label}
                  type="button"
                  data-ui-modal-primary={isPrimary ? '' : undefined}
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
