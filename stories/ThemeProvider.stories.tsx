import type { Meta, StoryObj } from '@storybook/react'
import { ThemeProvider, Button, Card } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
import { previewTheme } from '../.storybook/PreviewTheme'
const meta: Meta<typeof ThemeProvider> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },  title: 'Foundations/ThemeProvider', component: ThemeProvider, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Nested: StoryObj = { render: (_, context) => <><p>The outer preview retains its selected theme.</p><ThemeProvider theme={{ ...previewTheme(context.globals.theme), radius: 'sharp' }} style={{ padding: 24, background: 'var(--ui-surface)' }}><Card><p>This nested preview uses the existing sharp radius preset.</p><Button type="button">Nested button</Button></Card></ThemeProvider><Button type="button">Outer button</Button></> }
