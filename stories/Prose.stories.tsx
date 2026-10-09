import type { Meta, StoryObj } from '@storybook/react'
import { Prose } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Prose> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/Prose', component: Prose, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj<typeof Prose> = { render: () => <Prose as="article"><h2>Authored content</h2><p>The consumer supplies semantic HTML. Prose sets a reading width and shared type values.</p><ul><li>One clear topic</li><li>A useful next step</li></ul></Prose> }
