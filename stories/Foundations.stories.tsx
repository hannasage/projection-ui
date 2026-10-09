import { usePreviewTheme } from '../.storybook/PreviewTheme'
import { useState } from 'react'
import type { UIRadius } from '@hannasage/projection-ui/core'
import type { Meta, StoryObj } from '@storybook/react'
import { ButtonGroup, LinkButton, Card, ThemeProvider, UI_FOUNDATIONS } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta = { title: 'Foundations/Tokens', decorators: [withTheme] }
export default meta
const colorFields = ['bg', 'surface', 'border', 'text', 'muted', 'primary', 'primaryFg', 'danger'] as const
function PaletteSwatches() {
  const theme = usePreviewTheme()
  return <table className="docs-token-table"><caption>{theme.name} colors</caption><thead><tr><th scope="col">Role</th><th scope="col">Value</th></tr></thead><tbody>{colorFields.map(field => <tr key={field}><th scope="row">{field}</th><td><span className="docs-swatch" style={{ background: theme[field] }} aria-hidden="true" />{theme[field]}</td></tr>)}</tbody></table>
}
export const Palette: StoryObj = { render: () => <PaletteSwatches /> }
export const Scales: StoryObj = { render: () => <div>{Object.entries(UI_FOUNDATIONS).map(([group, values]) => <section key={group}><h2>{group}</h2><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(values, null, 2)}</pre></section>)}</div> }

function RadiusExplorer() {
  const theme = usePreviewTheme()
  const [radius, setRadius] = useState<UIRadius>('soft')
  return <><ButtonGroup aria-label="Radius preset" value={radius} onChange={setRadius} options={[{value:'sharp',label:'Sharp'},{value:'soft',label:'Soft'},{value:'rounded',label:'Rounded'}]} /><ThemeProvider theme={{...theme, radius}} style={{padding:24}}><Card><p>The selected radius stays inside this preview.</p><LinkButton href="/docs/theming/">Read the theme guide</LinkButton></Card></ThemeProvider></>
}
export const Radius: StoryObj = { render: () => <RadiusExplorer /> }
