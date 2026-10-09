import type { Meta, StoryObj } from '@storybook/react'
import { LinkButton } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof LinkButton> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/LinkButton', component: LinkButton, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj<typeof LinkButton> = { render: () => <LinkButton target="_top" href="./?path=/docs/guides-installation--docs" variant="primary">Read installation</LinkButton> }
export const Gradient: StoryObj<typeof LinkButton> = { render: () => <LinkButton target="_top" href="./?path=/docs/guides-installation--docs" variant="primary" appearance="gradient">Read installation</LinkButton> }
