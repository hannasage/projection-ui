import type { Decorator } from '@storybook/react'
import { ThemeProvider } from '@hannasage/projection-ui/core'
import { previewTheme } from '../.storybook/PreviewTheme'

export const withTheme: Decorator = (Story, context) => (
  <ThemeProvider
    theme={previewTheme(context.globals.theme)}
    style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)', fontFamily: 'var(--ui-font-body, var(--ui-font))', lineHeight: 1.55, padding: 16 }}
  >
    <Story />
  </ThemeProvider>
)
