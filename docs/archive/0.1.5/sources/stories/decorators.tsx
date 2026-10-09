import React from 'react'
import type { Decorator } from '@storybook/react'
import { ThemeProvider } from '../src/components/ThemeProvider'
import type { UITheme } from '../src/theme'

export const darkTheme: UITheme = {
  bg:        '#07090C',
  surface:   '#0D1117',
  border:    '#1B2535',
  text:      '#DDE3EE',
  muted:     '#8396AB',
  primary:   '#C9F53A',
  primaryFg: '#07090C',
  danger:    '#FF5252',
  font:      "'IBM Plex Mono', monospace",
  radius:    'soft',
}

export const withTheme: Decorator = (Story) => (
  <ThemeProvider
    theme={darkTheme}
    style={{ background: 'var(--ui-bg)', minHeight: '100vh', padding: 24 }}
  >
    <Story />
  </ThemeProvider>
)
