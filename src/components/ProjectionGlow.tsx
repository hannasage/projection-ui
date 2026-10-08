import React from 'react'

export interface ProjectionGlowProps {
  /** Inherits the current theme's primary color when omitted. */
  color?: React.CSSProperties['color']
  intensity?: 'subtle' | 'standard'
  /** A single entrance reveal. The default remains still. */
  motion?: 'none' | 'reveal'
  className?: string
  style?: React.CSSProperties
}

/** Decorative light field. Place authored content in a separate sibling. */
export function ProjectionGlow({ color, intensity = 'standard', motion = 'none', className, style }: ProjectionGlowProps) {
  return <div
    aria-hidden="true"
    className={['ui-projection-glow', className].filter(Boolean).join(' ')}
    data-intensity={intensity}
    data-motion={motion}
    style={{ ...style, '--ui-glow-color': color ?? 'var(--ui-primary)', pointerEvents: 'none' } as React.CSSProperties}
  >
    <span className="ui-projection-glow-halo" />
    <span className="ui-projection-glow-line" />
  </div>
}
