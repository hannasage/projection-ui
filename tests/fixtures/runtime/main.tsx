import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { ThemeProvider, Input, Select, Textarea, Toggle, ButtonGroup, Modal, DataTable, Skeleton, Button, Badge, Card, Slider } from '@hannasage/projection-ui'
import { SortableList, SortableItem } from '@hannasage/projection-ui'
import { ToastContainer, useToastStore } from '@hannasage/projection-ui'
import '@hannasage/projection-ui/tokens'

const theme = { bg:'#07090C', surface:'#0D1117', border:'#1B2535', text:'#DDE3EE', muted:'#8396AB', primary:'#C9F53A', primaryFg:'#07090C', danger:'#FF5252', font:'monospace', radius:'soft' as const }
function App() {
  const [open, setOpen] = useState(false)
  const [nested, setNested] = useState(false)
  const [checked, setChecked] = useState(false)
  const [changes, setChanges] = useState(0)
  const [radio, setRadio] = useState('first')
  const [row, setRow] = useState('')
  const [items, setItems] = useState([{id:'alpha'}, {id:'beta'}, {id:'gamma'}])
  return <ThemeProvider theme={theme} style={{background:theme.bg,color:theme.text,padding:20}}><main>
    <h1>Package interaction fixture</h1>
    <Input label="Email" hint="First hint" /><Input label="Email" error="Invalid email" />
    <Select label="Choice" hint="Select hint" options={[{value:'a',label:'A'}]} />
    <Textarea label="Notes" error="Notes required" />
    <Toggle label="Notifications" checked={checked} onChange={value => { setChecked(value); setChanges(x => x + 1) }} />
    <output data-testid="changes">{changes}</output>
    <Toggle label="Disabled notifications" disabled checked={false} onChange={() => setChanges(x => x + 1)} />
    <ButtonGroup aria-label="Options" options={[{value:'first',label:'First'}, {value:'disabled',label:'Disabled',disabled:true}, {value:'last',label:'Last'}]} value={radio} onChange={setRadio} />
    <button type="button" onClick={() => setOpen(true)}>Open modal</button>
    {createPortal(<Modal title="Outer modal" open={open} onDismiss={() => setOpen(false)} actions={[{label:'Close',onClick:() => setOpen(false)}]}>
      <button type="button" onClick={() => setNested(true)}>Open nested</button>
      {nested && <button type="button">Dynamic control</button>}
      <Modal title="Nested modal" open={nested} onDismiss={() => setNested(false)} actions={[{label:'Close nested',onClick:() => setNested(false)}]}>Nested content</Modal>
    </Modal>, document.body)}
    <DataTable aria-label="People" columns={[{key:'name',header:'Name',sortable:true,cell:(item: {id:string;name:string}) => item.name}]} data={[{id:'b',name:'Beta'}, {id:'a',name:'Alpha'}, {id:'c',name:'Alpha'}]} rowKey={item => item.id} onRowClick={item => setRow(item.id)} />
    <DataTable aria-label="Values" columns={[{key:'value',header:'Value',sortable:true,sortValue:(item: {id:string;value:number|null}) => item.value,cell:item => String(item.value)}]} data={[{id:'empty',value:null},{id:'ten',value:10},{id:'two',value:2},{id:'another-two',value:2}]} rowKey={item => item.id} />
    <output data-testid="row">{row}</output>
    <SortableList items={items} onReorder={setItems}>{item => <SortableItem key={item.id} id={item.id}>{({dragHandleProps}) => <button type="button" {...dragHandleProps}>{item.id}</button>}</SortableItem>}</SortableList>
    <output data-testid="order">{items.map(item => item.id).join(',')}</output>
    <button type="button" onClick={() => useToastStore.getState().push('Saved')}>Notify</button>
    <ToastContainer /><Skeleton /><Button>Example action</Button><Badge>Example badge</Badge><Card>Example card</Card><Slider label="Volume" value={20} onChange={() => {}} />
  </main></ThemeProvider>
}
createRoot(document.getElementById('root')!).render(<App />)
