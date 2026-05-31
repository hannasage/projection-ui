import React from 'react'

export interface SkeletonProps {
  width?:        string | number
  height?:       string | number
  borderRadius?: string
  className?:    string
  style?:        React.CSSProperties
}

export function Skeleton({
  width        = '100%',
  height       = 16,
  borderRadius = 'var(--ui-radius-sm)',
  className,
  style,
}: SkeletonProps): React.ReactElement {
  return (
    <>
      <style>{`
        @keyframes ui-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .ui-skeleton {
          background: linear-gradient(
            90deg,
            var(--ui-border) 25%,
            color-mix(in srgb, var(--ui-border) 60%, var(--ui-surface)) 50%,
            var(--ui-border) 75%
          );
          background-size: 800px 100%;
          animation: ui-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>
      <div
        className={`ui-skeleton${className ? ` ${className}` : ''}`}
        style={{ width, height, borderRadius, ...style }}
        aria-hidden="true"
      />
    </>
  )
}
