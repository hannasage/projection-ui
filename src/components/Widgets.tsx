import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

const panel: React.CSSProperties = { border: '1px solid var(--ui-border)', borderRadius: 16, background: 'var(--ui-surface)', color: 'var(--ui-text)', fontFamily: 'var(--ui-font-body, var(--ui-font))', padding: 16 }
const control: React.CSSProperties = { border: '1px solid var(--ui-border)', borderRadius: 8, background: 'transparent', color: 'var(--ui-text)', padding: '8px 12px', cursor: 'pointer', font: 'inherit' }
function useValue<T>(value: T | undefined, initial: T, onChange?: (value: T) => void) {
  const [local, setLocal] = useState(initial)
  const change = useCallback((next: T) => { if (value === undefined) setLocal(next); onChange?.(next) }, [value, onChange])
  return [value === undefined ? local : value, change] as const
}
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> { src?: string; alt: string; fallback?: React.ReactNode; size?: number }
export function Avatar({ src, alt, fallback, size = 40, style, ...rest }: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string>()
  return <span {...rest} role="img" aria-label={alt} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: size, height: size, flexShrink: 0, borderRadius: '50%', background: 'var(--ui-border)', color: 'var(--ui-text)', fontFamily: 'var(--ui-font-body, var(--ui-font))', ...style }}>{src && failedSource !== src ? <img src={src} alt="" onError={() => setFailedSource(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : fallback ?? alt.slice(0, 2).toUpperCase()}</span>
}
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> { label: React.ReactNode }
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, style, ...rest }, ref) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ui-text)', fontFamily: 'var(--ui-font-body, var(--ui-font))' }}><input {...rest} ref={ref} type="checkbox" style={{ accentColor: 'var(--ui-primary)', width: 18, height: 18, ...style }} />{label}</label>
})
export interface RadioOption { value: string; label: React.ReactNode; disabled?: boolean }
export interface RadioGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> { label: string; options: RadioOption[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; name?: string }
export function RadioGroup({ label, options, value, defaultValue = '', onValueChange, name, style, disabled, ...rest }: RadioGroupProps) {
  const id = useId(); const [selected, select] = useValue(value, defaultValue, onValueChange)
  return <fieldset {...rest} disabled={disabled} style={{ border: 0, margin: 0, padding: 0, color: 'var(--ui-text)', fontFamily: 'var(--ui-font-body, var(--ui-font))', ...style }}><legend style={{ marginBottom: 8 }}>{label}</legend>{options.map(option => <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}><input type="radio" name={name ?? id} value={option.value} checked={selected === option.value} disabled={option.disabled} onChange={() => select(option.value)} style={{ accentColor: 'var(--ui-primary)' }}/>{option.label}</label>)}</fieldset>
}
export interface TabItem { value: string; label: React.ReactNode; content: React.ReactNode; disabled?: boolean }
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> { items: TabItem[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; label?: string }
export function Tabs({ items, value, defaultValue, onValueChange, label = 'Tabs', style, ...rest }: TabsProps) {
  const id = useId(); const [selected, select] = useValue(value, defaultValue ?? items.find(item => !item.disabled)?.value ?? '', onValueChange)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const active = items.find(item => item.value === selected && !item.disabled) ?? items.find(item => !item.disabled)
  return <div {...rest} style={{ fontFamily: 'var(--ui-font-body, var(--ui-font))', color: 'var(--ui-text)', ...style }}><div role="tablist" aria-label={label} style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--ui-border)' }}>{items.map((item, index) => <button key={item.value} ref={node => { buttons.current[index] = node }} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active?.value === item.value} tabIndex={active?.value === item.value ? 0 : -1} disabled={item.disabled} style={{ ...control, background: active?.value === item.value ? 'var(--ui-accent-soft, transparent)' : 'transparent', color: active?.value === item.value ? 'var(--ui-accent-text, var(--ui-text))' : 'var(--ui-text)', border: 0, borderBottom: active?.value === item.value ? '2px solid var(--ui-primary)' : '2px solid transparent', borderRadius: 0, opacity: item.disabled ? .45 : 1 }} onClick={() => select(item.value)} onKeyDown={event => {
    const enabled = items.map((entry, i) => entry.disabled ? -1 : i).filter(i => i >= 0)
    const position = enabled.indexOf(index)
    let next: number | undefined
    if (event.key === 'ArrowRight') next = enabled[(position + 1) % enabled.length]
    if (event.key === 'ArrowLeft') next = enabled[(position - 1 + enabled.length) % enabled.length]
    if (event.key === 'Home') next = enabled[0]
    if (event.key === 'End') next = enabled[enabled.length - 1]
    if (next !== undefined) { event.preventDefault(); select(items[next].value); buttons.current[next]?.focus() }
  }}>{item.label}</button>)}</div>{items.map((item, index) => <div key={item.value} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active?.value !== item.value} tabIndex={0} style={{ padding: '16px 0' }}>{item.content}</div>)}</div>
}
export interface AccordionItem { value: string; title: React.ReactNode; content: React.ReactNode; disabled?: boolean }
export interface AccordionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> { items: AccordionItem[]; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void }
export function Accordion({ items, value, defaultValue = [], onValueChange, style, ...rest }: AccordionProps) {
  const id = useId(); const [expanded, change] = useValue(value, defaultValue, onValueChange)
  return <div {...rest} className={`ui-material-glass ${rest.className ?? ''}`} style={{ ...panel, background: undefined, padding: 0, ...style }}>{items.map((item, i) => { const open = expanded.includes(item.value); return <div key={item.value} style={{ borderTop: i ? '1px solid var(--ui-border)' : undefined }}><h3 style={{ margin: 0 }}><button type="button" disabled={item.disabled} id={`${id}-trigger-${i}`} aria-expanded={open} aria-controls={`${id}-content-${i}`} style={{ ...control, width: '100%', border: 0, textAlign: 'left', padding: 16, display: 'flex', justifyContent: 'space-between', opacity: item.disabled ? .45 : 1 }} onClick={() => change(open ? expanded.filter(entry => entry !== item.value) : [...expanded, item.value])}>{item.title}<span aria-hidden="true">{open ? '−' : '+'}</span></button></h3><div id={`${id}-content-${i}`} aria-labelledby={`${id}-trigger-${i}`} hidden={!open} style={{ padding: '0 16px 16px' }}>{item.content}</div></div> })}</div>
}
export type AlertTone = 'info' | 'success' | 'warning' | 'danger'
export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> { tone?: AlertTone; title?: React.ReactNode }
const tones: Record<AlertTone, string> = { info: 'var(--ui-primary)', success: 'var(--ui-success)', warning: 'var(--ui-warning)', danger: 'var(--ui-danger)' }
export function Alert({ tone = 'info', title, children, style, ...rest }: AlertProps) {
  return <div role={tone === 'danger' ? 'alert' : 'status'} {...rest} className={`ui-material-glass ui-edge-light ${rest.className ?? ''}`} style={{ ...panel, background: undefined, borderLeft: `1px solid ${tones[tone]}`, ...style }}>{title && <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>}{children}</div>
}
export interface NotificationProps extends AlertProps { onDismiss?: () => void; dismissLabel?: string }
export function Notification({ onDismiss, dismissLabel = 'Dismiss notification', children, ...rest }: NotificationProps) {
  const [dismissed, dismiss] = useState(false)
  if (dismissed) return null
  return <Alert {...rest}><div style={{ display: 'flex', alignItems: 'start', gap: 16 }}><div style={{ flex: 1 }}>{children}</div><button type="button" aria-label={dismissLabel} style={{ ...control, padding: '2px 8px' }} onClick={() => { dismiss(true); onDismiss?.() }}>×</button></div></Alert>
}
export interface ProgressProps extends Omit<React.ProgressHTMLAttributes<HTMLProgressElement>, 'value' | 'max'> { value?: number; max?: number; label: string }
export function Progress({ value, max = 100, label, style, ...rest }: ProgressProps) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100
  const amount = value === undefined ? undefined : Number.isFinite(value) ? Math.max(0, Math.min(limit, value)) : 0
  return <progress {...rest} className={`ui-progress ${rest.className ?? ''}`} aria-label={label} value={amount} max={limit} style={{ width: '100%', height: 8, accentColor: 'var(--ui-primary)', ...style }}/>
}
export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> { label?: string; size?: number }
export function Spinner({ label = 'Loading', size = 24, style, ...rest }: SpinnerProps) {
  return <span {...rest} className={`ui-spinner ${rest.className ?? ''}`} role="status" aria-label={label} style={{ display: 'inline-flex', width: size, height: size, borderRadius: '50%', border: '3px solid var(--ui-border)', borderTopColor: 'var(--ui-primary)', ...style }} />
}
export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content' | 'children'> { content: React.ReactNode; children: React.ReactElement<React.HTMLAttributes<HTMLElement>> }
export function Tooltip({ content, children, style, ...rest }: TooltipProps) {
  const id = useId(); const [hover, setHover] = useState(false); const [focused, setFocused] = useState(false); const [dismissed, dismiss] = useState(false)
  const open = (hover || focused) && !dismissed
  return <span {...rest} style={{ display: 'inline-flex', position: 'relative', ...style }} onMouseEnter={event => { setHover(true); dismiss(false); rest.onMouseEnter?.(event) }} onMouseLeave={event => { setHover(false); rest.onMouseLeave?.(event) }} onFocus={event => { setFocused(true); dismiss(false); rest.onFocus?.(event) }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); rest.onBlur?.(event) }} onKeyDown={event => { if (event.key === 'Escape') dismiss(true); rest.onKeyDown?.(event) }}>{React.cloneElement(children, { 'aria-describedby': [children.props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') || undefined })}{open && <span id={id} role="tooltip" style={{ ...panel, position: 'absolute', zIndex: 10, bottom: '100%', left: '50%', transform: 'translateX(-50%)', padding: '8px 12px', marginBottom: 6, whiteSpace: 'normal', width: 'max-content', maxWidth: 'min(20rem, calc(100vw - 32px))', boxSizing: 'border-box' }}>{content}</span>}</span>
}
export interface CarouselItem { id: string; content: React.ReactNode; label?: string }
export interface CarouselProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> { items: CarouselItem[]; index?: number; defaultIndex?: number; onIndexChange?: (index: number) => void; autoAdvance?: boolean; interval?: number; label: string }
export function Carousel({ items, index, defaultIndex = 0, onIndexChange, autoAdvance = false, interval = 5000, label, style, ...rest }: CarouselProps) {
  const [selected, select] = useValue(index, defaultIndex, onIndexChange)
  const [paused, pause] = useState(false); const [hover, setHover] = useState(false); const [focus, setFocus] = useState(false)
  const [hidden, setHidden] = useState(false); const [reduced, setReduced] = useState(true)
  const current = Math.max(0, Math.min(items.length - 1, Number.isFinite(selected) ? Math.trunc(selected) : 0))
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const updateMotion = () => setReduced(media.matches); const updateHidden = () => setHidden(document.hidden); updateMotion(); updateHidden(); media.addEventListener('change', updateMotion); document.addEventListener('visibilitychange', updateHidden); return () => { media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateHidden) } }, [])
  useEffect(() => { if (!autoAdvance || paused || hover || focus || hidden || reduced || items.length < 2) return; const timer = window.setInterval(() => select((current + 1) % items.length), Number.isFinite(interval) ? Math.max(250, interval) : 5000); return () => window.clearInterval(timer) }, [autoAdvance, paused, hover, focus, hidden, reduced, items.length, interval, current, select])
  return <div {...rest} role="region" aria-roledescription="carousel" aria-label={label} className={`ui-material-glass ui-edge-light ${rest.className ?? ''}`} style={{ ...panel, background: undefined, ...style }} onMouseEnter={event => { setHover(true); rest.onMouseEnter?.(event) }} onMouseLeave={event => { setHover(false); rest.onMouseLeave?.(event) }} onFocus={event => { setFocus(true); rest.onFocus?.(event) }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false); rest.onBlur?.(event) }}><div aria-live={autoAdvance && !paused && !hover && !focus && !hidden && !reduced ? 'off' : 'polite'}>{items.map((item, i) => <div key={item.id} role="group" aria-roledescription="slide" aria-label={item.label ?? `${i + 1} of ${items.length}`} hidden={i !== current}>{item.content}</div>)}</div><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}><button type="button" aria-label="Previous slide" disabled={items.length < 2} style={control} onClick={() => select((current - 1 + items.length) % items.length)}>←</button><span style={{ fontFamily: 'var(--ui-font)', color: 'var(--ui-muted)' }}>{items.length ? current + 1 : 0} / {items.length}</span><button type="button" aria-label="Next slide" disabled={items.length < 2} style={control} onClick={() => select((current + 1) % items.length)}>→</button>{autoAdvance && <button type="button" style={control} onClick={() => pause(!paused)}>{paused ? 'Resume slides' : 'Pause slides'}</button>}</div></div>
}
