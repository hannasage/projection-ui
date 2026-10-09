import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Toggle } from '../../src/components/forms/Toggle'
import { withTheme } from '../decorators'

const meta: Meta = {
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
      hint="You'll receive email updates when new activity occurs"
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
