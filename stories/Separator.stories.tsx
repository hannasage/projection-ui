import type { Meta, StoryObj } from '@storybook/react'
import { Separator } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Separator> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/Separator', component: Separator, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj<typeof Separator> = { render: () => <><p>First topic</p><Separator /><p>Next topic</p></> }
