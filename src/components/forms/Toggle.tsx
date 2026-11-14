import React, { useId, useRef } from 'react'
import { useFollowerMotion, useMotionRuntime } from '../motionContext'

export interface ToggleProps {
  checked:    boolean
  onChange:   (checked: boolean) => void
  label?:     string
  hint?:      string
  disabled?:  boolean
  size?:      'sm' | 'md'
  className?: string
  'aria-label'?: string
  style?:     React.CSSProperties
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  size     = 'md',
  className,
  style,
  'aria-label': ariaLabel,
}: ToggleProps): React.ReactElement {
  const hintId = useId()
  const trackW  = size === 'sm' ? 30 : 38
  const trackH  = size === 'sm' ? 17 : 22
  const thumbSz = size === 'sm' ? 11 : 16
  const thumbOff = size === 'sm' ? 3  : 3
  const travel   = trackW - thumbSz - 2 * thumbOff
  const at       = checked ? 1 : 0
  // With a MotionProvider, the thumb follows a spring on every input, keyboard too. The track fill fades with the same
  // number, so a turn in flight keeps colour and position together. Without one, the static CSS transition stays.
  const runtime  = useMotionRuntime()
  const root     = useRef<HTMLDivElement | null>(null)
  useFollowerMotion(root, runtime, 'thumb', at)

  return (
    <label
      className={className}
      style={{
        display:    'inline-flex',
        alignItems: 'flex-start',
        gap:        10,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled ? 0.45 : 1,
        fontFamily: 'var(--ui-font-body, var(--ui-font))',
        ...style,
      }}
    >
      <div className="ui-toggle" ref={root} data-pui-motion={runtime ? '' : undefined} style={{ flexShrink: 0, marginTop: 1, position: 'relative' }}>
        <style>{`
          .ui-toggle:has(input:focus-visible) .ui-toggle-track { outline: 2px solid var(--ui-focus, var(--ui-primary)); outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) { .ui-toggle-track, .ui-toggle-thumb { transition: none !important; } }
        `}</style>
        <input
          type="checkbox"
          role="switch"
          aria-label={ariaLabel ?? label}
          aria-describedby={hint ? hintId : undefined}
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', margin: 0, zIndex: 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <div
          className="ui-toggle-track"
          aria-hidden="true"
          style={{
            width:        trackW,
            height:       trackH,
            borderRadius: 'var(--ui-radius-full)',
            background:   checked && !runtime ? 'var(--ui-accent-fill, var(--ui-primary))' : 'var(--ui-border)',
            position:     'relative',
            transition:   runtime ? undefined : 'background 0.18s',
            flexShrink:   0,
          }}
        >
          {runtime && <span className="ui-toggle-fill" style={{
            position:     'absolute',
            inset:        0,
            borderRadius: 'inherit',
            background:   'var(--ui-accent-fill, var(--ui-primary))',
            opacity:      `var(--pui-thumb, ${at})`,
          }} />}
          <div className="ui-toggle-thumb" style={{
            position:     'absolute',
            top:          thumbOff,
            left:         thumbOff,
            translate:    runtime ? `calc(var(--pui-thumb, ${at}) * ${travel}px) 0` : `${at * travel}px 0`,
            width:        thumbSz,
            height:       thumbSz,
            borderRadius: 'var(--ui-radius-full)',
            background:   checked ? 'var(--ui-primary-fg)' : 'var(--ui-muted)',
            transition:   runtime ? 'background-color var(--ui-motion-normal, 0.18s)' : 'translate 0.18s, background 0.18s',
          }} />
        </div>
      </div>
      {(label || hint) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {label && (
            <span style={{ fontSize: 13, color: 'var(--ui-text)', lineHeight: 1.3 }}>
              {label}
            </span>
          )}
          {hint && (
            <span id={hintId} style={{ fontSize: 11, color: 'var(--ui-muted)', lineHeight: 1.4 }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </label>
  )
}
