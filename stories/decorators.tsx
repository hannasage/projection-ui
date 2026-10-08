import type { Decorator } from '@storybook/react'
import { ThemeProvider } from '@hannasage/projection-ui/core'
import { DEFAULT_THEME } from '@hannasage/projection-ui/core'

export const darkTheme = DEFAULT_THEME

export const withTheme: Decorator = (Story) => (
  <ThemeProvider
    theme={darkTheme}
    style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)', fontFamily: 'var(--ui-font-body, var(--ui-font))', lineHeight: 1.55, padding: 16 }}
  >
    <Story />
  </ThemeProvider>
)
