import React, { useEffect } from 'react'
import { create } from 'zustand'

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

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

const VARIANT_COLOR: Record<ToastVariant, string> = {
  info:    'var(--ui-primary)',
  success: '#51CF66',
  warning: '#FFB347',
  danger:  'var(--ui-danger)',
}

interface ToastItemProps {
  toast:     Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps): React.ReactElement {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4100)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  const bar = VARIANT_COLOR[toast.variant]

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display:     'flex',
        alignItems:  'stretch',
        background:  'var(--ui-surface)',
        border:      '1px solid var(--ui-border)',
        borderRadius:'var(--ui-radius-md)',
        overflow:    'hidden',
        boxShadow:   '0 8px 32px rgba(0,0,0,0.35)',
        fontFamily:  'var(--ui-font)',
        minWidth:    260,
        maxWidth:    380,
        animation:   'ui-toast-in 0.18s ease',
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
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          background:   'transparent',
          border:       'none',
          padding:      '0 12px',
          cursor:       'pointer',
          color:        'var(--ui-muted)',
          fontSize:     16,
          fontFamily:   'var(--ui-font)',
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
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        aria-label="Notifications"
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
