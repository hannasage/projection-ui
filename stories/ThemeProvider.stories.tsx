import type { Meta, StoryObj } from '@storybook/react'
import { ThemeProvider, Button, Card, DEFAULT_THEME } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof ThemeProvider> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },  title: 'Foundations/ThemeProvider', component: ThemeProvider, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Nested: StoryObj = { render: () => <><p>The outer preview retains its default theme.</p><ThemeProvider theme={{ ...DEFAULT_THEME, radius: 'sharp' }} style={{ padding: 24, background: 'var(--ui-surface)' }}><Card><p>This nested preview uses the existing sharp radius preset.</p><Button type="button">Nested button</Button></Card></ThemeProvider><Button type="button">Outer button</Button></> }
