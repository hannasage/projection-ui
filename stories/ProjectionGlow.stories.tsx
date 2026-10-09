import type { Meta, StoryObj } from '@storybook/react'
import { ProjectionGlow } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof ProjectionGlow> = {
  title: 'Components/ProjectionGlow', component: ProjectionGlow, decorators: [withTheme], tags: ['autodocs'],
  parameters: { docs: { description: { component: 'A decorative light field. It inherits the theme primary color and remains still by default. Import the scoped styles with the core entry.' } } },
}
export default meta
export const Default: StoryObj<typeof ProjectionGlow> = { render: () => <div style={{ width: 'min(100%, 48rem)', position: 'relative', background: 'var(--ui-bg)' }}><ProjectionGlow /><h2 style={{ position: 'absolute', inset: 'auto 1rem 2rem', textAlign: 'center', color: 'var(--ui-text)', fontFamily: 'var(--ui-font-display)', margin: 0 }}>Light behind the content</h2></div> }
export const Subtle: StoryObj<typeof ProjectionGlow> = { args: { intensity: 'subtle' } }
export const Reveal: StoryObj<typeof ProjectionGlow> = { args: { motion: 'reveal' } }
export const CustomColor: StoryObj<typeof ProjectionGlow> = { args: { color: '#8CB4FF', style: { height: '12rem' } } }
