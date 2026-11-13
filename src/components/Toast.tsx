import React, { useRef } from 'react'
import { create } from 'zustand'
import { useEnterMotion, useMotionRuntime } from './motionContext'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export interface Toast {
  id:       string
  message:  string
  variant:  ToastVariant
}

interface ToastState {
  toasts: Toast[]
  push:   (message: string, variant?: ToastVariant) => void
  dismiss:(id: string) => void
}
const expiry = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    expiry.set(id, setTimeout(() => {
      expiry.delete(id)
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000))
  },
  dismiss: (id) => {
    clearTimeout(expiry.get(id))
    expiry.delete(id)
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

const VARIANT_COLOR: Record<ToastVariant, string> = {
  info:    'var(--ui-primary)',
  success: 'var(--ui-success, #51CF66)',
  warning: 'var(--ui-warning, #FFB347)',
  danger:  'var(--ui-danger)',
}

interface ToastItemProps {
  toast:     Toast
  onDismiss: (id: string) => void
}

// With a MotionProvider, a new toast rises in and fades in on a spring that goes from 0 to 1. Without one, the CSS enter stays.
const TOAST_ENTER: React.CSSProperties = { opacity: 'var(--pui-enter, 1)', translate: '0 calc((1 - var(--pui-enter, 1)) * 8px)' }

function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactElement {
  const bar = VARIANT_COLOR[toast.variant]
  const runtime = useMotionRuntime()
  const root = useRef<HTMLDivElement | null>(null)
  useEnterMotion(root, runtime, 'enter', true)

  return (
    <div
      className="ui-toast"
      ref={root}
      style={{
        display:     'flex',
        alignItems:  'stretch',
        background:  'var(--ui-surface)',
        border:      '1px solid var(--ui-border)',
        borderRadius:'var(--ui-radius-md)',
        overflow:    'hidden',
        boxShadow:   '0 8px 32px rgba(0,0,0,0.35)',
        fontFamily:  'var(--ui-font-body, var(--ui-font))',
        minWidth:    260,
        maxWidth:    380,
        animation:   runtime ? undefined : 'ui-toast-in 0.18s ease',
        ...(runtime ? TOAST_ENTER : undefined),
      }}
    >
      {/* Accent bar */}
      <div style={{ width: 3, background: bar, flexShrink: 0 }} />

      <div style={{
        flex:        1,
        padding:     '10px 14px',
        fontSize:    13,
        color:       'var(--ui-text)',
        lineHeight:  1.45,
      }}>
        {toast.message}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          background:   'transparent',
          border:       'none',
          padding:      '0 12px',
          cursor:       'pointer',
          color:        'var(--ui-muted)',
          fontSize:     16,
          fontFamily:   'var(--ui-font-body, var(--ui-font))',
          flexShrink:   0,
        }}
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer(): React.ReactElement {
  const { toasts, dismiss } = useToastStore()

  return (
    <>
      <style>{`
        @keyframes ui-toast-in {
          from { opacity: 0; translate: 0 8px; }
          to   { opacity: 1; translate: 0 0; }
        }
        @media (prefers-reduced-motion: reduce) { .ui-toast { animation: none !important; } }
      `}</style>
      <div
        role="log"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position:       'fixed',
          bottom:         24,
          right:          24,
          zIndex:         9999,
          display:        'flex',
          flexDirection:  'column',
          gap:            8,
          pointerEvents:  toasts.length ? 'auto' : 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  )
}
