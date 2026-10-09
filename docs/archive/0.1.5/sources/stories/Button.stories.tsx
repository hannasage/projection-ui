import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '../src/components/Button'
import { withTheme } from './decorators'

const meta: Meta<typeof Button> = {
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
