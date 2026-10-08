import React from 'react'
import type { ButtonSize, ButtonVariant } from './Button'

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  maxWidth?: React.CSSProperties['maxWidth']
}
/** Shared document and embedded-content width; no page layout or navigation. */
export function Container({ as: Tag = 'div', maxWidth = '72rem', style, ...props }: ContainerProps) {
  return <Tag {...props} style={{ width: '100%', maxWidth, marginInline: 'auto', boxSizing: 'border-box', ...style }} />
}
export interface StackProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  gap?: React.CSSProperties['gap']
  direction?: 'row' | 'column'
}
export function Stack({ as: Tag = 'div', gap = 'var(--ui-space-md, 12px)', direction = 'column', style, ...props }: StackProps) {
  return <Tag {...props} style={{ display: 'flex', flexDirection: direction, gap, minWidth: 0, ...style }} />
}
export interface ProseProps extends React.HTMLAttributes<HTMLElement> { as?: React.ElementType }
/** Styling only; authored HTML stays under the consumer's control. */
export function Prose({ as: Tag = 'div', className, style, ...props }: ProseProps) {
  return <Tag {...props} className={['ui-prose', className].filter(Boolean).join(' ')} style={{ fontFamily: 'var(--ui-font-body, var(--ui-font))', color: 'var(--ui-text)', fontSize: 'var(--ui-font-size-md, 13px)', lineHeight: 'var(--ui-line-height-body, 1.55)', maxWidth: '70ch', overflowWrap: 'anywhere', ...style }} />
}
export interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
}
export function LinkButton({ variant = 'secondary', size = 'md', style, target, rel, ...props }: LinkButtonProps) {
  const primary = variant === 'primary'
  const danger = variant === 'danger'
  const padding = { sm: '5px 10px', md: '8px 16px', lg: '10px 22px' }[size]
  return <a {...props} target={target} rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding, fontFamily: 'var(--ui-font)', fontSize: {sm:11,md:12,lg:13}[size], color: primary ? 'var(--ui-primary-fg)' : danger ? 'var(--ui-danger)' : 'var(--ui-text)', background: primary ? 'var(--ui-primary)' : 'transparent', border: variant === 'ghost' ? '1px solid transparent' : `1px solid var(${primary ? '--ui-primary' : danger ? '--ui-danger' : '--ui-border'})`, borderRadius: 'var(--ui-radius-md)', textDecoration: 'none', ...style }} />
}
export type SeparatorProps = React.HTMLAttributes<HTMLHRElement>
export function Separator({ style, ...props }: SeparatorProps) {
  return <hr {...props} style={{ border: 0, borderBlockStart: '1px solid var(--ui-border)', width: '100%', marginBlock: 'var(--ui-space-lg, 16px)', ...style }} />
}
export type VisuallyHiddenProps = React.HTMLAttributes<HTMLSpanElement>
export function VisuallyHidden({ style, ...props }: VisuallyHiddenProps) {
  return <span {...props} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0, ...style }} />
}
