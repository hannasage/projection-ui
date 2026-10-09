import { useState } from 'react'
import { BarChart, DEFAULT_CHART_COLORS } from '@hannasage/projection-ui/charts'
import type { Meta, StoryObj } from '@storybook/react'
import { Accordion, Alert, Avatar, Badge, Button, ButtonGroup, Card, Carousel, Checkbox, DataTable, COASTAL_DAY_FLAT_THEME, COASTAL_DAY_THEME, GradientBackground, GradientText, Input, LinkButton, Modal, Notification, Progress, PROJECTION_FLAT_THEME, PROJECTION_THEME, RadioGroup, Separator, Skeleton, Slider, Spinner, Surface, Tabs, Textarea, ThemeProvider, Toggle, Tooltip } from '@hannasage/projection-ui/core'

const meta: Meta = { title: 'Gallery/Components', includeStories: ['Paired'], parameters: { layout: 'fullscreen' } }
export default meta
export const galleryCategories = ['Avatars','Badges','Buttons','Icons','Links','Profiles','Tags','Checkboxes','Forms','Inputs','Radio Groups','Selects','Sliders','Text Areas','Toggles','Sign Ins','Signups','Onboarding','Progress','Empty States','File Uploads','Accordions','Dropdowns','File Trees','Lists','Menus','Paginations','Search Bars','Sidebars','Tabs','Calendars','Date Pickers','Alerts','Dialogs/Modals','Notifications','Popovers','Spinner Loaders','Toasts','Tooltips','Cards','Carousels','Grids & Bento','Tables','AI Chats','Charts & Data Viz','Dashboards','Numbers','Cursors','Globes'] as const
const nativeCategories = new Set(['Avatars','Badges','Buttons','Checkboxes','Inputs','Radio Groups','Sliders','Text Areas','Toggles','Progress','Accordions','Tabs','Alerts','Dialogs/Modals','Notifications','Spinner Loaders','Tooltips','Cards','Carousels','Tables'])
const categorySamples: Record<typeof galleryCategories[number], string> = {
  Avatars:'Avatars',Badges:'Badges',Buttons:'Buttons',Icons:'Icons',Links:'Links',Profiles:'Profile',Tags:'Tags',Checkboxes:'Checkboxes',Forms:'Settings',Inputs:'Inputs','Radio Groups':'Radio buttons',Selects:'Selects',Sliders:'Sliders','Text Areas':'Textarea',Toggles:'Toggles','Sign Ins':'Sign in',Signups:'Signup',Onboarding:'Onboarding',Progress:'Progress','Empty States':'Empty state','File Uploads':'File upload',Accordions:'Accordion',Dropdowns:'Dropdowns','File Trees':'File tree',Lists:'File list',Menus:'Command menu',Paginations:'Pagination','Search Bars':'Search',Sidebars:'Navigation',Tabs:'Tabs',Calendars:'Calendar','Date Pickers':'Date picker',Alerts:'Alerts','Dialogs/Modals':'Dialog',Notifications:'Notifications',Popovers:'Popover','Spinner Loaders':'Spinners',Toasts:'Toast',Tooltips:'Tooltips',Cards:'Cards',Carousels:'Carousel','Grids & Bento':'Bento',Tables:'Data table','AI Chats':'Chat','Charts & Data Viz':'Chart summary',Dashboards:'Dashboard',Numbers:'Stats',Cursors:'Cursor',Globes:'Globe'
}

function Sample({ category }: { category: string }) {
  const [active, setActive] = useState('overview')
  const [checked, setChecked] = useState(true)
  const [value, setValue] = useState(64)
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(true)
  const action = <Button appearance="gradient" onClick={() => setCount(count + 1)}>Add item{count ? ` · ${count}` : ''}</Button>
  switch (category) {
    case 'Icons': return <div className="gallery-row"><svg aria-label="Check" role="img" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 4 4L19 6" /></svg><svg aria-label="Add" role="img" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg></div>
    case 'Links': return <LinkButton href="/docs/theming/">Read the theme guide</LinkButton>
    case 'Tags': return <ButtonGroup aria-label="Filter by tag" value={active} onChange={setActive} options={[{value:'overview',label:'Design'},{value:'code',label:'Code'},{value:'review',label:'Review'}]} />
    case 'Selects': return <label>Workspace <select value={active} onChange={event => setActive(event.currentTarget.value)}><option value="overview">Personal</option><option value="team">Team</option></select></label>
    case 'Signup': return <form onSubmit={event => {event.preventDefault();setMessage('Example account form submitted.')}}><Input label="Name" required /><Input label="Email" type="email" required /><Checkbox label="Receive product updates" defaultChecked /><Button type="submit">Create account</Button><p role="status">{message}</p></form>
    case 'Onboarding': return <><Progress label="Setup steps" value={count} max={3} /><p>Step {Math.min(count + 1,3)} of 3: {['Choose a workspace','Add your profile','Review your settings','Setup complete'][Math.min(count,3)]}</p><Button disabled={count >= 3} onClick={() => setCount(count + 1)}>Continue setup</Button></>
    case 'File upload': return <><Input label="Choose a file" type="file" onChange={event => setMessage(event.currentTarget.files?.[0]?.name ?? '')} /><p role="status">{message ? `${message} selected locally` : 'No file selected.'}</p></>
    case 'Dropdowns': return <><Button aria-expanded={open} onClick={() => setOpen(!open)}>Workspace actions</Button>{open && <div><Button onClick={() => {setMessage('Draft created');setOpen(false)}}>Create draft</Button></div>}<p role="status">{message}</p></>
    case 'File tree': return <details open><summary>Project files</summary><ul><li><a href="/markdown/theming.md">Theming.md</a></li><li><a href="/markdown/tokens.md">Tokens.md</a></li></ul></details>
    case 'Date picker': return <Input label="Review date" type="date" />
    case 'Popover': return <><Button aria-expanded={open} onClick={() => setOpen(!open)}>Review details</Button>{open && <Surface material="glass" style={{padding:16,marginTop:12}}>Two reviewers. One open draft.</Surface>}</>
    case 'Toast': return <><Button onClick={() => setVisible(!visible)}>Toggle saved message</Button>{visible && <div role="status" style={{marginTop:16}}><Notification title="Draft saved" onDismiss={() => setVisible(false)}>Your changes stay in this example.</Notification></div>}</>
    case 'Bento': return <div style={{display:'grid',gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)',gap:12}}><Card material="glass" edgeLight><h3>Workspace</h3><p>Material studies</p></Card><Card material="glass" underglow><Badge>Ready</Badge></Card><Card style={{gridColumn:'1 / -1'}}><Progress label="Review completion" value={72} /></Card></div>
    case 'Chat': return <form onSubmit={event => {event.preventDefault();setCount(count+1);setMessage('')}}><p>Example assistant: What would you like to explore?</p>{count > 0 && <p role="status">{count} local message{count === 1 ? '' : 's'} sent. This example does not call an AI service.</p>}<Input label="Your message" value={message} required onChange={event => setMessage(event.currentTarget.value)} /><Button type="submit">Send message locally</Button></form>
    case 'Cursor': return <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{['default','pointer','text','grab','not-allowed'].map(cursor => <span key={cursor} style={{cursor,padding:12,border:'1px solid var(--ui-border)'}}>{cursor}</span>)}</div>
    case 'Globe': return <figure style={{margin:0}}><svg role="img" aria-label="Static globe illustration" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="var(--ui-primary)" strokeWidth="1"><circle cx="60" cy="60" r="48" /><ellipse cx="60" cy="60" rx="22" ry="48" /><ellipse cx="60" cy="60" rx="48" ry="18" /><path d="M12 60h96M60 12v96" /></svg><figcaption>Static SVG composition</figcaption></figure>
    case 'Buttons': return <div className="gallery-row">{action}<Button onClick={() => setCount(0)} disabled={!count}>Reset</Button><Button variant="ghost" onClick={() => setCount(count + 1)}>Add quietly</Button></div>
    case 'Badges': return <div className="gallery-row"><Badge>In progress</Badge><Badge filled>Published</Badge></div>
    case 'Avatars': return <div className="gallery-row"><Avatar alt="Alex Rivera" fallback="AR" /><Avatar alt="Sam Lee" fallback="SL" size={48} /></div>
    case 'Inputs': return <Input label="Project name" defaultValue="Material studies" />
    case 'Checkboxes': return <Checkbox label="Include email updates" checked={checked} onChange={event => setChecked(event.currentTarget.checked)} />
    case 'Radio buttons': return <RadioGroup label="View density" defaultValue="comfortable" options={[{value:'compact',label:'Compact'},{value:'comfortable',label:'Comfortable'}]} />
    case 'Toggles': return <Toggle label="Notifications" checked={checked} onChange={setChecked} />
    case 'Sliders': return <Slider label="Volume" value={value} onChange={setValue} />
    case 'Progress': return <Progress label="Upload progress" value={value} />
    case 'Spinners': return <Spinner label="Loading preview" />
    case 'Tooltips': return <Tooltip content="Adds a local example item">{action}</Tooltip>
    case 'Tabs': return <Tabs label="Project sections" items={[{value:'overview',label:'Overview',content:'Your project is ready for review.'},{value:'activity',label:'Activity',content:'Draft saved. Review requested.'}]} />
    case 'Accordion': return <Accordion items={[{value:'files',title:'Which files are included?',content:'The package contains JavaScript, types, styles, and theme values.'},{value:'themes',title:'Can I change the theme?',content:'Use a nested ThemeProvider to set a different palette.'}]} />
    case 'Alerts': return <Alert title="Draft saved" tone="success">Your local changes are ready.</Alert>
    case 'Notifications': return visible ? <Notification title="Review requested" onDismiss={() => setVisible(false)}>Alex added a comment.</Notification> : <Button onClick={() => setVisible(true)}>Show notification</Button>
    case 'Cards': return <Card><h3>Material study</h3><p>Soft light. Clear boundaries.</p>{action}</Card>
    case 'Glass panels': return <GradientBackground variant="spotlight"><Surface material="glass" style={{padding:20}}><h3>Glass surface</h3><p>The backdrop remains visible.</p>{action}</Surface></GradientBackground>
    case 'Edge light': return <Surface material="glass" edgeLight style={{padding:20}}>Light follows the top edge.</Surface>
    case 'Underlight': return <Surface material="glass" underglow style={{padding:20}}>A quiet light beneath the surface.</Surface>
    case 'Gradients': return <GradientBackground variant="horizon" style={{padding:24,minHeight:100}}>Horizon</GradientBackground>
    case 'Gradient text': return <GradientText>Make room for possibility.</GradientText>
    case 'Navigation': return <Tabs label="Navigation composition" items={[{value:'home',label:'Home',content:'Home workspace'},{value:'projects',label:'Projects',content:'Material studies · Release notes'}]} />
    case 'Breadcrumbs': return <nav aria-label="Breadcrumb"><a href="/docs/">Docs</a> / <a href="/docs/theming/">Theming</a> / <span aria-current="page">Materials</span></nav>
    case 'Pagination': return <ButtonGroup aria-label="Example page" options={['1','2','3'].map(page => ({value:page,label:page}))} value={active} onChange={setActive} />
    case 'Search': return <><Input label="Search projects" value={message} onChange={event => setMessage(event.currentTarget.value)} /><p>{'Material studies'.toLowerCase().includes(message.toLowerCase()) ? 'Material studies' : 'No matching projects.'}</p></>
    case 'Command menu': return <><Input label="Find a command" value={message} onChange={event => setMessage(event.currentTarget.value)} />{['Create draft','Save draft'].filter(label => label.toLowerCase().includes(message.toLowerCase())).map(label => <Button key={label} onClick={() => setMessage(`${label} selected`)}>{label}</Button>)}</>
    case 'Select menu': return <RadioGroup label="Workspace" options={[{value:'personal',label:'Personal'},{value:'team',label:'Team'}]} defaultValue="personal" />
    case 'Textarea': return <Textarea label="Review notes" defaultValue="The top edge feels calm and clear." />
    case 'Data table': return <DataTable aria-label="Project files" columns={[{key:'name',header:'Name',cell:row => row.name,sortable:true},{key:'status',header:'Status',cell:row => row.status}]} data={[{name:'Material study',status:'Draft'},{name:'Release notes',status:'Ready'}]} rowKey={row => row.name} />
    case 'Chart summary': return <><BarChart title="Synthetic review activity" height={180} data={[{day:'Mon',reviews:4},{day:'Tue',reviews:6},{day:'Wed',reviews:3}]} xKey="day" series={[{key:'reviews',label:'Reviews',color:DEFAULT_CHART_COLORS[0]}]} /><table tabIndex={0}><caption>Example review counts</caption><thead><tr><th scope="col">Day</th><th scope="col">Reviews</th></tr></thead><tbody><tr><th scope="row">Monday</th><td>4</td></tr><tr><th scope="row">Tuesday</th><td>6</td></tr><tr><th scope="row">Wednesday</th><td>3</td></tr></tbody></table></>
    case 'Stats': return <><h3>12 completed reviews</h3><p>Of 16 requested this week.</p><Progress label="Completed reviews" value={12} max={16} /></>
    case 'Activity feed': case 'Timeline': return <ol><li>Draft created</li><li>Review requested</li><li>Feedback added</li></ol>
    case 'Profile': return <><Avatar alt="Alex Rivera" fallback="AR" /><h3>Alex Rivera</h3><p>Design systems · Available for reviews</p><Toggle label="Follow updates" checked={checked} onChange={setChecked} /></>
    case 'Team': return <><div className="gallery-row"><Avatar alt="Alex Rivera" fallback="AR" /><Avatar alt="Sam Lee" fallback="SL" /></div><p>Two reviewers in this workspace.</p>{action}</>
    case 'Settings': return <><Input label="Workspace name" defaultValue="Studio" /><Toggle label="Weekly digest" checked={checked} onChange={setChecked} /></>
    case 'Sign in': return <form onSubmit={event => {event.preventDefault();setMessage('Example sign-in submitted.')}}><Input label="Email" type="email" required /><Input label="Password" type="password" required /><Button type="submit" appearance="gradient">Sign in</Button><p role="status">{message}</p></form>
    case 'Pricing': return <><h3>Studio</h3><p>A plan for shared reviews.</p><Button onClick={() => setMessage('Studio selected')}>Select Studio</Button><p role="status">{message}</p></>
    case 'Empty state': return <><h3>No saved drafts</h3><p>Start a draft to collect your ideas.</p><Button onClick={() => setMessage('New local draft created')}>Create draft</Button><p role="status">{message}</p></>
    case 'Loading state': return <><Skeleton height={18} width="70%" /><Skeleton height={18} width="90%" /></>
    case 'Dialog': return <><Button onClick={() => setOpen(true)}>Review draft</Button><Modal open={open} title="Review draft" onDismiss={() => setOpen(false)}><p>Your draft is ready for a final read.</p></Modal></>
    case 'Carousel': return <Carousel label="Material studies" items={[{id:'glass',label:'Glass',content:<Surface material="glass" style={{padding:24}}>Glass study</Surface>},{id:'solid',label:'Solid',content:<Surface style={{padding:24}}>Solid study</Surface>}]} />
    case 'File list': return <ul><li><a href="/markdown/theming.md">Theming.md</a></li><li><a href="/markdown/tokens.md">Tokens.md</a></li></ul>
    case 'Calendar': return <RadioGroup label="Choose a review day" options={[{value:'mon',label:'Monday'},{value:'tue',label:'Tuesday'},{value:'wed',label:'Wednesday'}]} defaultValue="tue" />
    case 'Dashboard': return <><h3>Workspace overview</h3><Badge>Review open</Badge><Progress label="Review completion" value={72} />{action}</>
    case 'Footer': return <footer><p>Projection UI</p><LinkButton href="/docs/">Documentation</LinkButton></footer>
    case 'Separators': return <><p>Project details</p><Separator /><p>Review history</p></>
    case 'Button groups': return <ButtonGroup aria-label="View" variant="segmented" value={active} onChange={setActive} options={[{value:'overview',label:'Overview'},{value:'activity',label:'Activity'}]} />
    case 'Status': return <><Badge>All changes saved</Badge><p role="status">Your workspace is up to date.</p></>
  }
}
function Gallery() {
  const [appearance,setAppearance] = useState('neon')
  return <main className="component-gallery"><header><h1>Components</h1><p>Coastal Day in the light. Projection in the dark.</p><a href="/docs/">Read the documentation</a><div className="gallery-mode"><ButtonGroup aria-label="Core appearance" value={appearance} onChange={setAppearance} options={[{value:'neon',label:'Modern materials'},{value:'flat',label:'Flat surfaces'}]} /></div></header>{galleryCategories.map(category => <section key={category} aria-label={category}><h2>{category}</h2>{!nativeCategories.has(category) && <p className="gallery-kind">Composition using library components</p>}<div className="gallery-pair">{[{name:appearance === 'flat' ? 'Coastal Day Flat · Light' : 'Coastal Day · Light',theme:appearance === 'flat' ? COASTAL_DAY_FLAT_THEME : COASTAL_DAY_THEME},{name:'Projection · Dark',theme:appearance === 'flat' ? PROJECTION_FLAT_THEME : PROJECTION_THEME}].map(({name,theme}) => <ThemeProvider key={name} theme={theme} className="gallery-theme"><p className="gallery-theme-label">{theme.name} · {theme.mode === 'light' ? 'Light' : 'Dark'}</p><div className="gallery-sample"><Sample category={categorySamples[category]} /></div></ThemeProvider>)}</div></section>)}</main>
}
export const Paired: StoryObj = { render: () => <Gallery /> }
