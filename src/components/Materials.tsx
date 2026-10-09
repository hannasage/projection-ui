import React from 'react'

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  material?: 'solid' | 'glass'
  edgeLight?: boolean
  underglow?: boolean
}
/** Import the scoped stylesheet once alongside your themed application. */
export function Surface({ material = 'solid', edgeLight = false, underglow = false, className = '', children, ...props }: SurfaceProps) {
  return <div {...props} className={`ui-surface ${className}`.trim()} data-material={material} data-edge-light={edgeLight || undefined} data-underglow={underglow || undefined}>{children}</div>
}
export interface GradientBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'wash' | 'spotlight' | 'horizon' | 'atmosphere'
}
export function GradientBackground({ variant = 'wash', className = '', children, ...props }: GradientBackgroundProps) {
  return <div {...props} className={`ui-gradient-background ${className}`.trim()} data-variant={variant}>{children}</div>
}
export interface GradientTextProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}
/** Display headings only; the stylesheet enforces a 24px minimum. */
export function GradientText({ as: Tag = 'h2', className = '', children, ...props }: GradientTextProps) {
  return <Tag {...props} className={`ui-gradient-text ${className}`.trim()}>{children}</Tag>
}
