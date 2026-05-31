import React, { useId } from 'react'

export interface SliderProps {
  value:       number
  onChange:    (value: number) => void
  min?:        number
  max?:        number
  step?:       number
  label?:      string
  /** Formats the displayed value. Defaults to String(value). */
  valueFormat?:(value: number) => string
  hint?:       string
  disabled?:   boolean
  className?:  string
  style?:      React.CSSProperties
}

export function Slider({
  value,
  onChange,
  min        = 0,
  max        = 100,
  step       = 1,
  label,
  valueFormat,
  hint,
  disabled   = false,
  className,
  style,
}: SliderProps): React.ReactElement {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100

  return (
    <>
      <style>{`
        .ui-slider-track {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: var(--ui-radius-full);
          outline: none;
          cursor: pointer;
          background: linear-gradient(
            to right,
            var(--ui-primary) 0%,
            var(--ui-primary) var(--ui-slider-pct, 0%),
            var(--ui-border)  var(--ui-slider-pct, 0%),
            var(--ui-border)  100%
          );
        }
        .ui-slider-track:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ui-slider-track::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: var(--ui-radius-full);
          background: var(--ui-primary);
          border: 2px solid var(--ui-primary-fg);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.1s;
        }
        .ui-slider-track::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .ui-slider-track::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: var(--ui-radius-full);
          background: var(--ui-primary);
          border: 2px solid var(--ui-primary-fg);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        }
        .ui-slider-track:focus-visible {
          outline: 2px solid var(--ui-primary);
          outline-offset: 3px;
          border-radius: var(--ui-radius-full);
        }
      `}</style>

      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}
      >
        {(label || valueFormat !== undefined || value !== undefined) && (
          <div style={{
            display:         'flex',
            justifyContent:  'space-between',
            alignItems:      'baseline',
            fontFamily:      'var(--ui-font)',
          }}>
            {label && (
              <label
                htmlFor={id}
                style={{ fontSize: 11, color: 'var(--ui-muted)', letterSpacing: 0.5 }}
              >
                {label}
              </label>
            )}
            <span style={{ fontSize: 12, color: 'var(--ui-text)', fontWeight: 500, marginLeft: 'auto' }}>
              {valueFormat ? valueFormat(value) : value}
            </span>
          </div>
        )}

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ui-slider-track"
          style={{ '--ui-slider-pct': `${pct}%` } as React.CSSProperties}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueFormat ? valueFormat(value) : String(value)}
        />

        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          fontFamily:     'var(--ui-font)',
          fontSize:       10,
          color:          'var(--ui-muted)',
        }}>
          <span>{valueFormat ? valueFormat(min) : min}</span>
          <span>{valueFormat ? valueFormat(max) : max}</span>
        </div>

        {hint && (
          <span style={{ fontSize: 11, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)' }}>
            {hint}
          </span>
        )}
      </div>
    </>
  )
}
