import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
import { expect, fn, userEvent, within } from '@storybook/test'

const meta: Meta<typeof Button> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },
  title:      'Components/Button',
  component:  Button,
  decorators: [withTheme],
  tags:       ['autodocs'],
  args: { onClick: fn() },
  argTypes: {
    children: { control: 'text', description: 'Visible button label.' },
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger', 'icon'], table: { defaultValue: { summary: 'secondary' } } },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'], table: { defaultValue: { summary: 'md' } } },
    appearance: { control: 'inline-radio', options: ['solid', 'gradient'], table: { defaultValue: { summary: 'gradient' } } },
    disabled: { control: 'boolean' }, block: { control: 'boolean' },
    onClick: { control: false, description: 'Receives the native click event. See Actions.' },
  },
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

export const KeyboardActivation: Story = {
  args: { children: 'Try keyboard activation', variant: 'primary' },
  parameters: { docs: { description: { story: 'The play function focuses the button and presses Enter. Open Interactions to inspect each assertion and Actions to inspect the native click event.' } } },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Try keyboard activation' })
    button.focus()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}
