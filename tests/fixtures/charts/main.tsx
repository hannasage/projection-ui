import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, DEFAULT_THEME } from '@hannasage/projection-ui/core'
import * as Charts from '@hannasage/projection-ui/charts'
import '@hannasage/projection-ui/styles'

const data = [{ label: 'First', a: 3, b: 2 }, { label: 'Second', a: 5, b: 3 }, { label: 'Third', a: 2, b: 4 }]
const series = [{ key: 'a', label: 'Alpha', color: '' }, { key: 'b', label: 'Beta', color: '#ff0077' }]
function Fixture() {
  const [visible, setVisible] = useState(true)
  return <ThemeProvider theme={DEFAULT_THEME}><main style={{padding:40, background:'var(--ui-bg)',color:'var(--ui-text)'}}>
    <h1>Chart interaction fixture</h1><button onClick={() => setVisible(!visible)}>Toggle charts</button>
    <output data-testid="palette">{JSON.stringify('DEFAULT_CHART_COLORS' in Charts ? Charts.DEFAULT_CHART_COLORS : [])}</output>
    {visible && <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:40}}>
      <section data-testid="line"><Charts.LineChart data={data} series={series} xKey="label" title="Line" /></section>
      <section data-testid="bar"><Charts.BarChart data={data} series={series} xKey="label" title="Bar" /></section>
      <section data-testid="area"><Charts.AreaChart data={data} series={series} xKey="label" title="Area" /><Charts.AreaChart data={data} series={series} xKey="label" height={120} /></section>
      <section data-testid="donut"><Charts.DonutChart data={[{key:'a',label:'Alpha',value:3,color:''},{key:'b',label:'Beta',value:2,color:'#ff0077'}]} title="Donut" centerLabel={<span>5 items</span>} /></section>
    </div>}
  </main></ThemeProvider>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
