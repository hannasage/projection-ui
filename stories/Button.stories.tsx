import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'

const meta: Meta<typeof Button> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },
  title:      'Components/Button',
  component:  Button,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

type Story = StoryObj<typeof Button>

export const Primary: Story   = { args: { children: 'Primary',   variant: 'primary'   } }
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } }
export const Ghost: Story     = { args: { children: 'Ghost',     variant: 'ghost'     } }
export const Danger: Story    = { args: { children: 'Danger',    variant: 'danger'    } }
export const Small: Story     = { args: { children: 'Small',     size: 'sm'           } }
export const Large: Story     = { args: { children: 'Large',     size: 'lg'           } }
export const Disabled: Story  = { args: { children: 'Disabled',  disabled: true       } }
export const Block: Story     = { args: { children: 'Full width',block: true          } }
