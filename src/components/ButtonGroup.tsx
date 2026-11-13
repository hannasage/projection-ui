import React, { useRef } from 'react'
import { boxWithin, useLensMotion, useMotionRuntime } from './motionContext'

const SOFT_FILL = 'var(--ui-accent-soft, color-mix(in srgb, var(--ui-primary) 13%, transparent))'

/**
 * The travelling indicator, drawn only with a MotionProvider. The lens writes its box as variables, and the indicator shows it
 * with clip-path, so no layout property and no transform moves. Until the lens is ready (and on the server) the active option
 * keeps its own static fill, so the hand-over shows no flash.
 */
const LENS_STYLE = `
:is([data-pui-motion="chip"], [data-pui-motion="segmented"]) > .ui-lens {
  position: absolute; inset: 0; pointer-events: none; opacity: 0; background: ${SOFT_FILL};
  clip-path: inset(var(--pui-lens-y, 0px) calc(100% - var(--pui-lens-x, 0px) - var(--pui-lens-w, 0px)) calc(100% - var(--pui-lens-y, 0px) - var(--pui-lens-h, 0px)) var(--pui-lens-x, 0px) round var(--pui-lens-round, 0px));
}
[data-pui-motion="chip"] > .ui-lens { --pui-lens-round: var(--ui-radius-md); }
:is([data-pui-motion="chip"], [data-pui-motion="segmented"])[data-pui-lens="ready"] > .ui-lens { opacity: 1; }
:is([data-pui-motion="chip"], [data-pui-motion="segmented"]):not([data-pui-lens="ready"]) > [aria-checked="true"] { --pui-static-fill: ${SOFT_FILL}; }
`

export interface ButtonGroupOption<T extends string = string> {
  value:     T
  label:     React.ReactNode
  title?:    string
  disabled?: boolean
}

export interface ButtonGroupProps<T extends string = string> {
  options:      ButtonGroupOption<T>[]
  value:        T | null
  onChange:     (value: T) => void
  /**
   * chip (default) — individual floating pills with gaps, each with its own
   * border that activates on selection. Matches the brand's original chip style.
   *
   * segmented — joined control with shared outer border (iOS-style). Use for
   * binary mode toggles where the options are part of a unified whole.
   */
  variant?:     'chip' | 'segmented'
  deselectable?: boolean
  size?:        'sm' | 'md' | 'lg'
  /** Full-width equal-width options (segmented only — chips wrap naturally) */
  block?:       boolean
  className?:   string
  style?:       React.CSSProperties
  'aria-label'?: string
}

const SIZE: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
  sm: { padding: '4px 10px',  fontSize: 11 },
  md: { padding: '6px 14px',  fontSize: 12 },
  lg: { padding: '9px 20px',  fontSize: 13 },
}

export function ButtonGroup<T extends string = string>({
  options,
  value,
  onChange,
  variant      = 'chip',
  deselectable = false,
  size         = 'md',
  block        = false,
  className,
  style,
  'aria-label': ariaLabel,
}: ButtonGroupProps<T>): React.ReactElement {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
  const active = options.findIndex(option => option.value === value && !option.disabled)
  const tabStop = active >= 0 ? active : enabled[0]
  // With a MotionProvider, a lens travels to the option a pointer picks and jumps on a key (D15). It never targets a disabled option,
  // and with no selection it hides.
  const runtime = useMotionRuntime()
  const group = useRef<HTMLDivElement | null>(null)
  const keyboard = useRef(false)
  useLensMotion(group, runtime, () => group.current ? boxWithin(group.current, buttons.current[active]) : null, active, keyboard)
  const lens = runtime ? <span className="ui-lens" aria-hidden="true" /> : null
  const motionStyle = (isActive: boolean): React.CSSProperties => runtime
    ? { position: 'relative', background: 'var(--pui-static-fill, transparent)', transition: variant === 'segmented' ? 'color var(--ui-motion-fast, 0.12s)' : `color var(--ui-motion-fast, 0.12s), border-color var(--ui-motion-fast, 0.12s)` }
    : { background: isActive ? SOFT_FILL : 'transparent' }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const current = enabled.indexOf(index)
    let next: number | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = enabled[(current + 1) % enabled.length]
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = enabled[(current - 1 + enabled.length) % enabled.length]
    if (event.key === 'Home') next = enabled[0]
    if (event.key === 'End') next = enabled[enabled.length - 1]
    if (next === undefined) return
    event.preventDefault()
    keyboard.current = true
    buttons.current[next]?.focus()
    onChange(options[next].value)
  }
  const handleClick = (opt: ButtonGroupOption<T>) => {
    if (opt.disabled) return
    keyboard.current = false
    if (deselectable && opt.value === value) {
      onChange('' as T)
    } else if (opt.value !== value) {
      onChange(opt.value)
    }
  }

  if (variant === 'segmented') {
    return (
      <>
      {runtime && <style>{LENS_STYLE}</style>}
      <div
        ref={group}
        role="radiogroup"
        aria-label={ariaLabel}
        className={className}
        data-pui-motion={runtime ? 'segmented' : undefined}
        style={{
          position:     runtime ? 'relative' : undefined,
          display:      'inline-flex',
          borderRadius: 'var(--ui-radius-md)',
          border:       '1px solid var(--ui-border)',
          overflow:     'hidden',
          width:        block ? '100%' : undefined,
          ...style,
        }}
      >
        {lens}
        {options.map((opt, idx) => {
          const isActive = opt.value === value
          const isFirst  = idx === 0
          const isLast   = idx === options.length - 1
          return (
            <button
              key={opt.value}
              type="button"
              ref={node => { buttons.current[idx] = node }}
              tabIndex={idx === tabStop ? 0 : -1}
              onKeyDown={event => handleKeyDown(event, idx)}
              role="radio"
              aria-checked={isActive}
              title={opt.title}
              disabled={opt.disabled}
              onClick={() => handleClick(opt)}
              style={{
                ...SIZE[size],
                flex:           block ? 1 : undefined,
                fontFamily:     'var(--ui-font-body, var(--ui-font))',
                fontWeight:     isActive ? 600 : 400,
                color:          isActive ? 'var(--ui-accent-text, var(--ui-primary))' : 'var(--ui-muted)',
                border:         'none',
                borderLeft:     isFirst ? 'none' : '1px solid var(--ui-border)',
                borderRadius:   isFirst
                  ? 'calc(var(--ui-radius-md) - 1px) 0 0 calc(var(--ui-radius-md) - 1px)'
                  : isLast
                    ? '0 calc(var(--ui-radius-md) - 1px) calc(var(--ui-radius-md) - 1px) 0'
                    : '0',
                cursor:         opt.disabled ? 'not-allowed' : 'pointer',
                opacity:        opt.disabled ? 0.45 : 1,
                whiteSpace:     'nowrap',
                lineHeight:     1,
                transition:     'background 0.12s, color 0.12s',
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            5,
                ...motionStyle(isActive),
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      </>
    )
  }

  // chip variant — individual floating pills with gaps (the brand default)
  return (
    <>
    {runtime && <style>{LENS_STYLE}</style>}
    <div
      ref={group}
      role="radiogroup"
        aria-label={ariaLabel}
      className={className}
      data-pui-motion={runtime ? 'chip' : undefined}
      style={{
        position:  runtime ? 'relative' : undefined,
        display:   'flex',
        gap:       6,
        flexWrap:  block ? 'nowrap' : 'wrap',
        width:     block ? '100%' : undefined,
        ...style,
      }}
    >
      {lens}
      {options.map((opt, idx) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            ref={node => { buttons.current[idx] = node }}
            tabIndex={idx === tabStop ? 0 : -1}
            onKeyDown={event => handleKeyDown(event, idx)}
            role="radio"
            aria-checked={isActive}
            title={opt.title}
            disabled={opt.disabled}
            onClick={() => handleClick(opt)}
            style={{
              ...SIZE[size],
              flex:           block ? 1 : undefined,
              fontFamily:     'var(--ui-font-body, var(--ui-font))',
              fontWeight:     isActive ? 600 : 400,
              color:          isActive ? 'var(--ui-accent-text, var(--ui-primary))' : 'var(--ui-muted)',
              border:         isActive
                ? '1px solid var(--ui-primary)'
                : '1px solid var(--ui-border)',
              borderRadius:   'var(--ui-radius-md)',
              cursor:         opt.disabled ? 'not-allowed' : 'pointer',
              opacity:        opt.disabled ? 0.45 : 1,
              whiteSpace:     'nowrap',
              lineHeight:     1,
              transition:     'all 0.12s',
              display:        'inline-flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            5,
              ...motionStyle(isActive),
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
    </>
  )
}
