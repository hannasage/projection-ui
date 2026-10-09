import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Toggle } from '@hannasage/projection-ui/core'
import { withTheme } from '../decorators'

const meta: Meta<typeof Toggle> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },
  component: Toggle,
  title:      'Forms/Toggle',
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

function Demo(): React.ReactElement {
  const [checked, setChecked] = useState(false)
  return (
    <Toggle
      checked={checked}
      onChange={setChecked}
      label="Enable notifications"
      hint="Changes this example state only."
    />
  )
}

export const Default: StoryObj     = { render: () => <Demo /> }
export const Checked: StoryObj     = { render: () => <Toggle checked onChange={() => {}} label="Active" /> }
export const Disabled: StoryObj    = { render: () => <Toggle checked={false} onChange={() => {}} label="Disabled" disabled /> }
export const SmallSize: StoryObj   = { render: () => <Toggle checked onChange={() => {}} label="Small toggle" size="sm" /> }
export const Rounded: StoryObj     = {
  render: () => (
    <div style={{ '--ui-radius-full': '9999px' } as React.CSSProperties}>
      <Toggle checked onChange={() => {}} label="Rounded" />
    </div>
  ),
}
