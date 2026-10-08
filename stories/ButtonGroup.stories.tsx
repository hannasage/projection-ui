import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ButtonGroup } from '@hannasage/projection-ui/core'
import { withTheme, darkTheme } from './decorators'
import { ThemeProvider } from '@hannasage/projection-ui/core'

const meta: Meta<typeof ButtonGroup> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/codex/community-and-release-docs/docs/components.md) for required props and interaction behavior.' } } },
  component: ButtonGroup,
  title:      'Components/ButtonGroup',
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

type Metric = 'liquidity' | 'debt' | 'investments' | 'netWorth'

const metricOptions = [
  { value: 'liquidity'   as Metric, label: 'Liquidity'   },
  { value: 'debt'        as Metric, label: 'Debt'        },
  { value: 'investments' as Metric, label: 'Invested'    },
  { value: 'netWorth'    as Metric, label: 'Net worth'   },
]

function MetricDemo(): React.ReactElement {
  const [val, setVal] = useState<Metric>('liquidity')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ButtonGroup aria-label="Example selection" options={metricOptions} value={val} onChange={setVal} />
      <div style={{ fontSize: 12, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)' }}>
        Selected: <strong style={{ color: 'var(--ui-text)' }}>{val}</strong>
      </div>
    </div>
  )
}

type Year = '5' | '10' | '20' | '30'
const yearOptions = [
  { value: '5'  as Year, label: '5y'  },
  { value: '10' as Year, label: '10y' },
  { value: '20' as Year, label: '20y' },
  { value: '30' as Year, label: '30y' },
]

function YearClipDemo(): React.ReactElement {
  const [val, setVal] = useState<Year | null>('10')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ButtonGroup aria-label="Example selection" options={yearOptions} value={val} onChange={setVal} deselectable size="sm" />
      <div style={{ fontSize: 12, color: 'var(--ui-muted)', fontFamily: 'var(--ui-font)' }}>
        Clip years: <strong style={{ color: 'var(--ui-text)' }}>{val ?? 'none (full horizon)'}</strong>
      </div>
    </div>
  )
}

type Mode = 'none' | 'hysa' | 'invest'
const returnModeOptions = [
  { value: 'none'   as Mode, label: '0% cash',   title: 'No investment return' },
  { value: 'hysa'   as Mode, label: 'HYSA',       title: 'High-yield savings' },
  { value: 'invest' as Mode, label: '7% invested',title: 'Market investment' },
]

function ReturnModeDemo(): React.ReactElement {
  const [val, setVal] = useState<Mode>('hysa')
  return <ButtonGroup aria-label="Example selection" options={returnModeOptions} value={val} onChange={setVal} />
}

export const MetricSelection: StoryObj = {
  name: 'Metric selection (md)',
  render: () => <MetricDemo />,
}

export const YearClipChips: StoryObj = {
  name: 'Year clip chips (sm, deselectable)',
  render: () => <YearClipDemo />,
}

export const ReturnMode: StoryObj = {
  name: 'Return mode selector',
  render: () => <ReturnModeDemo />,
}

export const BlockLayout: StoryObj = {
  name: 'Block (full width)',
  render: function BlockLayoutExample() {
    const [val, setVal] = useState('b')
    return (
      <ButtonGroup aria-label="Example selection"
        block
        options={[
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
          { value: 'c', label: 'Option C' },
        ]}
        value={val}
        onChange={setVal}
      />
    )
  },
}

export const LargeSize: StoryObj = {
  name: 'Large size',
  render: function LargeSizeExample() {
    const [val, setVal] = useState('monthly')
    return (
      <ButtonGroup aria-label="Example selection"
        size="lg"
        options={[
          { value: 'monthly',   label: 'Monthly'   },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'annual',    label: 'Annual'    },
        ]}
        value={val}
        onChange={setVal}
      />
    )
  },
}

export const WithDisabledOption: StoryObj = {
  name: 'Disabled option',
  render: function WithDisabledOptionExample() {
    const [val, setVal] = useState('a')
    return (
      <ButtonGroup aria-label="Example selection"
        options={[
          { value: 'a', label: 'Available' },
          { value: 'b', label: 'Disabled', disabled: true },
          { value: 'c', label: 'Available' },
        ]}
        value={val}
        onChange={setVal}
      />
    )
  },
}

export const RadiusSharp: StoryObj = {
  name: 'Radius — Sharp',
  render: function RadiusSharpExample() {
    const [val, setVal] = useState('a')
    return (
      <ThemeProvider theme={{ ...darkTheme, radius: 'sharp' }} style={{ background: 'var(--ui-bg)', padding: 24 }}>
        <ButtonGroup aria-label="Example selection"
          options={[
            { value: 'a', label: 'Square' },
            { value: 'b', label: 'Edged'  },
            { value: 'c', label: 'Crisp'  },
          ]}
          value={val}
          onChange={setVal}
        />
      </ThemeProvider>
    )
  },
}

export const RadiusRounded: StoryObj = {
  name: 'Radius — Rounded',
  render: function RadiusRoundedExample() {
    const [val, setVal] = useState('a')
    return (
      <ThemeProvider theme={{ ...darkTheme, radius: 'rounded' }} style={{ background: 'var(--ui-bg)', padding: 24 }}>
        <ButtonGroup aria-label="Example selection"
          options={[
            { value: 'a', label: 'Soft'    },
            { value: 'b', label: 'Bubbly'  },
            { value: 'c', label: 'Pillowy' },
          ]}
          value={val}
          onChange={setVal}
        />
      </ThemeProvider>
    )
  },
}
