import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from '../src/components/Slider'
import { withTheme, darkTheme } from './decorators'
import { ThemeProvider } from '../src/components/ThemeProvider'

const meta: Meta<typeof Slider> = {
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
      hint="Current high-yield savings rate"
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
  render: () => <Controlled min={0} max={100} />,
}

export const RadiusSharp: Story = {
  name: 'Radius — Sharp',
  render: () => (
    <ThemeProvider theme={{ ...darkTheme, radius: 'sharp' }} style={{ background: 'var(--ui-bg)', padding: 24 }}>
      <Controlled label="Sharp radius" min={0} max={100} value={60} valueFormat={(v) => `${v}%`} />
    </ThemeProvider>
  ),
}

export const RadiusRounded: Story = {
  name: 'Radius — Rounded',
  render: () => (
    <ThemeProvider theme={{ ...darkTheme, radius: 'rounded' }} style={{ background: 'var(--ui-bg)', padding: 24 }}>
      <Controlled label="Rounded radius" min={0} max={100} value={60} valueFormat={(v) => `${v}%`} />
    </ThemeProvider>
  ),
}
