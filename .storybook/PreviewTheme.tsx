import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { Decorator } from '@storybook/react'
import { COASTAL_DAY_FLAT_THEME, COASTAL_DAY_THEME, PROJECTION_FLAT_THEME, PROJECTION_THEME } from '@hannasage/projection-ui/core'

export function previewTheme(value: unknown) {
  switch (value) {
    case 'light': return COASTAL_DAY_THEME
    case 'light-flat': return COASTAL_DAY_FLAT_THEME
    case 'dark-flat': return PROJECTION_FLAT_THEME
    default: return PROJECTION_THEME
  }
}

const PreviewThemeContext = createContext<ReturnType<typeof previewTheme>>(PROJECTION_THEME)
export const usePreviewTheme = () => useContext(PreviewThemeContext)

export function applyPreviewTheme(value: unknown) {
  const theme = previewTheme(value)
  document.documentElement.dataset.previewTheme = String(value ?? 'dark')
  document.documentElement.style.colorScheme = theme.mode
  document.documentElement.style.setProperty('--preview-bg', theme.bg)
  document.documentElement.style.setProperty('--preview-text', theme.text)
  document.documentElement.style.setProperty('--preview-muted', theme.muted)
  document.documentElement.style.setProperty('--preview-primary', theme.primary)
  document.documentElement.style.setProperty('--preview-accent-text', theme.mode === 'light' ? theme.text : theme.primary)
  document.documentElement.style.setProperty('--preview-primary-fg', theme.primaryFg)
  document.documentElement.style.setProperty('--preview-border', theme.border)
}

function PreviewTheme({ value, children }: { value: unknown; children: ReactNode }) {
  const theme = previewTheme(value)
  useEffect(() => applyPreviewTheme(value), [value])
  return <PreviewThemeContext.Provider value={theme}>{children}</PreviewThemeContext.Provider>
}

export const withPreviewTheme: Decorator = (Story, context) => <PreviewTheme value={context.globals.theme}><Story /></PreviewTheme>
