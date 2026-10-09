import type { Meta, StoryObj } from '@storybook/react'
import { Container } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Container> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/Container', component: Container, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj<typeof Container> = { render: () => <Container maxWidth="40rem"><p>A bounded reading region that keeps its full available width on small screens.</p></Container> }
