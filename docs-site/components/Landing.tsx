'use client';
import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useTheme } from 'fumadocs-ui/provider/base';
import { Avatar, Badge, Button, ButtonGroup, Card, GradientBackground, GradientText, Input, LinkButton, Progress, PROJECTION_FLAT_THEME, COASTAL_DAY_FLAT_THEME, COASTAL_DAY_THEME, PROJECTION_THEME, Slider, ThemeProvider, Toggle } from '@hannasage/projection-ui/core';
import '@hannasage/projection-ui/styles';
import { HeroFlow } from './HeroFlow';

// The theme bootstrap script runs before React. Keep its palette through hydration.
const bootstrapPalette = {
  '--ui-bg': 'var(--color-fd-background)',
  '--ui-surface': 'var(--color-fd-card)',
  '--ui-text': 'var(--color-fd-foreground)',
  '--ui-muted': 'var(--color-fd-muted-foreground)',
  '--ui-border': 'var(--color-fd-border)',
  '--ui-primary': 'var(--color-fd-primary)',
  '--ui-primary-fg': 'var(--color-fd-primary-foreground)',
  '--ui-partner': 'var(--landing-boot-partner)',
  '--ui-accent-end': 'var(--landing-boot-partner)',
  '--ui-accent-text': 'var(--color-fd-foreground)',
  '--ui-gradient-start': 'var(--color-fd-foreground)',
  '--ui-gradient-end': 'color-mix(in srgb, var(--color-fd-foreground) 72%, var(--color-fd-primary))',
};

const AI_PROMPT = "Oh great AI, take this elite component library and make my project super shiny and cool, like Hanna's projects! Read https://projectionui.dev/docs/ for setup, components, and themes. Then do your thing.";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function Landing() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [appearance,setAppearance] = useState('neon');
  const [notifications,setNotifications] = useState(true);
  const [volume,setVolume] = useState(64);
  const [project,setProject] = useState('Something worth shipping');
  const [saved,setSaved] = useState(false);
  const [promptStatus,setPromptStatus] = useState('');
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(AI_PROMPT); setPromptStatus('Prompt copied. Go make something shiny.'); }
    catch { setPromptStatus('Copy failed. Select the prompt text to copy it.'); }
  };
  const light = hydrated && resolvedTheme === 'light';
  const theme = light ? (appearance === 'flat' ? COASTAL_DAY_FLAT_THEME : COASTAL_DAY_THEME) : (appearance === 'flat' ? PROJECTION_FLAT_THEME : PROJECTION_THEME);
  return <ThemeProvider theme={theme} className="landing-shell" style={{'--ui-font': 'var(--reader-code)', '--ui-font-body': 'var(--reader-body)', '--ui-font-display': 'var(--reader-heading)', '--ui-font-mono': 'var(--reader-code)', ...(hydrated && resolvedTheme ? {} : bootstrapPalette)} as CSSProperties}><header className="landing-nav"><a href="/" className="landing-wordmark">Projection UI<span aria-hidden="true">.</span></a><nav aria-label="Main navigation"><a href="/docs/">Docs</a><a href="/examples/?path=/story/gallery-components--paired">Gallery</a><button type="button" aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setTheme(light ? 'dark' : 'light')}>{light ? 'Dark' : 'Light'}</button></nav></header><main id="nd-page" tabIndex={-1} className="landing-main"><section className="landing-hero" aria-labelledby="landing-title"><GradientBackground variant="spotlight" className="landing-hero-wash" aria-hidden="true" /><HeroFlow flat={appearance === 'flat'} light={light} /><div className="landing-copy"><GradientText as="h1" id="landing-title">Yes. Another UI library.</GradientText><p className="landing-lead">This one has a thing for light.</p><p>React components, glass surfaces, and themes you can change without rebuilding your interface. Just give our site to your AI, they'll know what to do.</p><div className="landing-actions"><LinkButton className="landing-primary" href="/docs/" variant="primary" appearance="gradient" style={{padding: '12px 18px', fontSize: 14}}>Read the docs <span aria-hidden="true">↗</span></LinkButton><a href="/examples/?path=/story/gallery-components--paired">Poke the components</a></div><p className="landing-release">Alpha · 0.2.0-next.2 · Candidate</p><div className="landing-ai-prompt"><blockquote>{AI_PROMPT}</blockquote><div className="landing-ai-actions"><Button size="sm" variant="secondary" onClick={copyPrompt}>Copy AI prompt</Button><span role="status">{promptStatus}</span></div></div></div><div className="landing-demo"><div className="landing-demo-toolbar"><span>Actual components. Actual buttons.</span><ButtonGroup aria-label="Preview appearance" value={appearance} onChange={setAppearance} options={[{value:'neon',label:'Modern'},{value:'flat',label:'Flat'}]} /></div><div className="landing-preview"><GradientBackground variant="atmosphere" className="landing-preview-backdrop"><Card material="glass" edgeLight underglow className="landing-project-card"><div className="landing-card-heading"><div><h2>Your next project</h2><p>Ambition sold separately.</p></div><Avatar alt="Example profile" fallback="UI" size={40} /></div><Input label="Project name" value={project} onChange={event => {setProject(event.currentTarget.value);setSaved(false)}} /><div className="landing-progress"><span>Setup progress</span><Badge>In progress</Badge></div><Progress label="Setup progress" value={volume} /><Slider label="Manufactured progress" value={volume} onChange={setVolume} /><Toggle label="Tell me when things happen" checked={notifications} onChange={setNotifications} /><div className="landing-card-actions"><Button appearance="gradient" variant="primary" onClick={() => setSaved(true)} disabled={!project.trim()}>Save project</Button><span role="status">{saved ? 'Saved in this preview.' : 'Go on. It works.'}</span></div></Card></GradientBackground></div></div></section><section className="landing-details" aria-label="What is included"><div><h2>Some assembly required.</h2><p>Controls, forms, tables, charts, and a theme system. The boring parts are useful. The shiny parts are optional.</p><a href="/docs/installation/">Start with installation</a></div><div><h2>Keep the light. Or lose it.</h2><p>Modern themes add glass and edge light. Projection adds a subtle lime gradient. Coastal Day uses a soft blue shift. Flat core themes keep solid surfaces. Your interface gets the final say.</p><a href="/docs/theming/">Explore the themes</a></div><div><h2>Alpha means alpha.</h2><p>This is an alpha pre-release. The component interface can change. Read the contracts before introducing it to your production app.</p><a href="/docs/releases/">Read the release notes</a></div></section><section className="landing-last" aria-labelledby="landing-last-title"><GradientText as="h2" id="landing-last-title">The screenshots are nice.<br />The controls should be too.</GradientText><p>Try the paired gallery. Check the accepted inputs. Decide whether your project needs another dependency.</p><a href="/examples/?path=/story/gallery-components--paired">Open the component gallery <span aria-hidden="true">↗</span></a></section></main><footer className="landing-footer"><span>Projection UI</span><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href="https://github.com/hannasage/projection-ui">Source</a><a href="/font-licenses/NOTICE.txt">Font licenses</a><a href="/third-party/NOTICE.txt">Graphics license</a></nav><span>Built to be used. Currently built to be tried.</span></footer></ThemeProvider>;
}
