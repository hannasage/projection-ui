import type { Meta, StoryObj } from '@storybook/react'
import { AreaChart, BarChart, DonutChart, LineChart, DEFAULT_CHART_COLORS } from '@hannasage/projection-ui/charts'
import { withTheme } from '../decorators'

const data = [{ label: 'First', alpha: 6, beta: 3 }, { label: 'Second', alpha: 4, beta: 5 }, { label: 'Third', alpha: 8, beta: 4 }, { label: 'Fourth', alpha: 5, beta: 7 }]
const series = [{ key: 'alpha', label: 'Alpha', color: DEFAULT_CHART_COLORS[0] }, { key: 'beta', label: 'Beta', color: DEFAULT_CHART_COLORS[1] }]
const slices = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map((label, index) => ({ key: label.toLowerCase(), label, value: index + 2, color: DEFAULT_CHART_COLORS[index] }))

function Palette() {
  return <div>
    <h2 style={{fontFamily:'var(--ui-font-display, var(--ui-font))',fontSize:24,color:'var(--ui-text)'}}>Chart palette</h2>
    <p style={{fontSize:16,color:'var(--ui-text)'}}>Synthetic example values</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',gap:24}}>
      <LineChart title="Line" data={data} series={series} xKey="label" />
      <BarChart title="Bar" data={data} series={series} xKey="label" />
      <AreaChart title="Area" data={data} series={series} xKey="label" />
      <DonutChart title="Donut" data={slices} centerLabel={<span style={{color:'var(--ui-text)'}}>27</span>} />
    </div>
    <ul style={{display:'flex',flexWrap:'wrap',gap:16,listStyle:'none',padding:0,fontSize:14,color:'var(--ui-text)'}}>{slices.map(slice => <li key={slice.key} style={{display:'flex',alignItems:'center',gap:6}}><span aria-hidden="true" style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:slice.color}} />{slice.label}: {slice.value}</li>)}</ul>
    <table tabIndex={0} style={{fontSize:14,color:'var(--ui-text)'}}><caption>Synthetic series values</caption><thead><tr><th scope="col">Label</th><th scope="col">Alpha</th><th scope="col">Beta</th></tr></thead><tbody>{data.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.alpha}</td><td>{row.beta}</td></tr>)}</tbody></table>
  </div>
}
const meta: Meta = {title:'Charts/ChartPalette',decorators:[withTheme],parameters:{docs:{description:{component:'DEFAULT_CHART_COLORS follows the theme primary color first. Mouse proximity adds a soft glow to marks. Touch, reduced motion, and forced colors keep the marks still.'}}}}
export default meta
export const Default: StoryObj = {render:() => <Palette />}
