import type { Meta, StoryObj } from '@storybook/react'
import { VisuallyHidden, Button } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof VisuallyHidden> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/VisuallyHidden', component: VisuallyHidden, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj<typeof VisuallyHidden> = { render: () => <Button type="button">Save<VisuallyHidden> this example</VisuallyHidden></Button> }
