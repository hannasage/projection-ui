import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
import { previewTheme } from '../.storybook/PreviewTheme'
import { ThemeProvider } from '@hannasage/projection-ui/core'

const meta: Meta<typeof Slider> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/d03bbaeb0321b95106207959e19c35e004438ff1/docs/components.md) for required props and interaction behavior.' } } },
  title:      'Components/Slider',
  component:  Slider,
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

function Controlled(props: Partial<React.ComponentProps<typeof Slider>>): React.ReactElement {
  const [val, setVal] = useState(props.value ?? 40)
  return <Slider {...props} value={val} onChange={setVal} />
}

type Story = StoryObj<typeof Slider>

export const Default: Story = {
  render: () => <Controlled label="Opacity" min={0} max={100} step={1} />,
}

export const WithValueFormat: Story = {
  render: () => (
    <Controlled
      label="HYSA rate"
      min={0}
      max={10}
      step={0.1}
      value={4.5}
      valueFormat={(v) => `${v.toFixed(1)}%`}
      hint="Synthetic rate for this example"
    />
  ),
}

export const CurrencyFormat: Story = {
  render: () => (
    <Controlled
      label="Monthly allowance"
      min={0}
      max={5000}
      step={50}
      value={1200}
      valueFormat={(v) => `$${v.toLocaleString()}`}
    />
  ),
}

export const Disabled: Story = {
  render: () => (
    <Controlled label="Locked" min={0} max={100} value={60} disabled />
  ),
}

export const NoLabel: Story = {
  render: () => <Controlled aria-label="Preview level" min={0} max={100} />,
}

export const RadiusSharp: Story = {
  name: 'Radius — Sharp',
  render: (_, context) => (
    <ThemeProvider theme={{ ...previewTheme(context.globals.theme), radius: 'sharp' }} style={{ background: 'var(--ui-bg)', padding: 24 }}>
      <Controlled label="Sharp radius" min={0} max={100} value={60} valueFormat={(v) => `${v}%`} />
    </ThemeProvider>
  ),
}

export const RadiusRounded: Story = {
  name: 'Radius — Rounded',
  render: (_, context) => (
    <ThemeProvider theme={{ ...previewTheme(context.globals.theme), radius: 'rounded' }} style={{ background: 'var(--ui-bg)', padding: 24 }}>
      <Controlled label="Rounded radius" min={0} max={100} value={60} valueFormat={(v) => `${v}%`} />
    </ThemeProvider>
  ),
}
