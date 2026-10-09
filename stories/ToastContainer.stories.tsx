import type { Meta, StoryObj } from '@storybook/react'
import { ToastContainer, useToastStore } from '@hannasage/projection-ui/toast'
import { Button } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'

const meta: Meta<typeof ToastContainer> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/toast`. This entry requires React and React DOM, and Zustand. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },  title: 'Components/ToastContainer', component: ToastContainer, decorators: [withTheme], tags: ['autodocs'] }
export default meta
type Story = StoryObj<typeof ToastContainer>

function ToastDemo() {
  const push = useToastStore(state => state.push)
  return <><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{(['info', 'success', 'warning', 'danger'] as const).map(variant => <Button key={variant} type="button" onClick={() => push(`Example ${variant} message`, variant)}>{variant}</Button>)}</div><ToastContainer /></>
}
export const Default: Story = { render: () => <ToastDemo /> }
