import { useState } from 'react'
import type { UIRadius } from '@hannasage/projection-ui/core'
import type { Meta, StoryObj } from '@storybook/react'
import { Button, ButtonGroup, Card, DEFAULT_THEME, ThemeProvider, UI_FOUNDATIONS } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta = { title: 'Foundations/Tokens', decorators: [withTheme] }
export default meta
const colorFields = ['bg', 'surface', 'border', 'text', 'muted', 'primary', 'primaryFg', 'danger'] as const
export const Palette: StoryObj = { render: () => <table className="docs-token-table"><caption>Default theme colors</caption><thead><tr><th scope="col">Role</th><th scope="col">Value</th></tr></thead><tbody>{colorFields.map(field => <tr key={field}><th scope="row">{field}</th><td><span className="docs-swatch" style={{ background: DEFAULT_THEME[field] }} aria-hidden="true" />{DEFAULT_THEME[field]}</td></tr>)}</tbody></table> }
export const Scales: StoryObj = { render: () => <div>{Object.entries(UI_FOUNDATIONS).map(([group, values]) => <section key={group}><h2>{group}</h2><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(values, null, 2)}</pre></section>)}</div> }

function RadiusExplorer() {
  const [radius, setRadius] = useState<UIRadius>('soft')
  return <><ButtonGroup aria-label="Radius preset" value={radius} onChange={setRadius} options={[{value:'sharp',label:'Sharp'},{value:'soft',label:'Soft'},{value:'rounded',label:'Rounded'}]} /><ThemeProvider theme={{...DEFAULT_THEME, radius}} style={{padding:24}}><Card><p>The selected radius stays inside this preview.</p><Button type="button" variant="primary">Example action</Button></Card></ThemeProvider></>
}
export const Radius: StoryObj = { render: () => <RadiusExplorer /> }
