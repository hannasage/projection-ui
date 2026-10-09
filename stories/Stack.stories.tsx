import type { Meta, StoryObj } from '@storybook/react'
import { Stack, Button } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof Stack> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/Stack', component: Stack, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj<typeof Stack> = { render: () => <Stack gap="var(--ui-space-lg)"><Button type="button">First action</Button><Button type="button">Second action</Button></Stack> }
