'use client';
import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useTheme } from 'fumadocs-ui/provider/base';
import { Avatar, Badge, Button, ButtonGroup, Card, GradientBackground, GradientText, Input, LinkButton, THEME_PRESETS, Progress, PROJECTION_FLAT_THEME, COASTAL_DAY_FLAT_THEME, COASTAL_DAY_THEME, PROJECTION_THEME, Slider, ThemeProvider, Toggle } from '@hannasage/projection-ui/core';
import '@hannasage/projection-ui/styles';
import { NavLight } from './NavLight';
import { useLandingMotion } from './useLandingMotion';

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

const pairs = {
  core: { label: 'Projection / Coastal Day', dark: PROJECTION_THEME, light: COASTAL_DAY_THEME, particles: { dark: '#D8FF87', light: '#086C9E' } },
  ember: { label: 'Ember Tide / Dust & Flame', dark: THEME_PRESETS['ember-tide'], light: THEME_PRESETS['dust-and-flame'], particles: { dark: '#FFB66F', light: '#9B4214' } },
  bloom: { label: 'Noir Bloom / Confetti Studio', dark: THEME_PRESETS['noir-bloom'], light: THEME_PRESETS['confetti-studio'], particles: { dark: '#FF8CCD', light: '#7635A4' } },
};

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function Landing() {
  const { resolvedTheme, setTheme } = useTheme();
  const motionRef = useLandingMotion();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [pair,setPair] = useState<keyof typeof pairs>('core');
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
  const selected = pairs[pair];
  const palette = light ? selected.light : selected.dark;
  const theme = appearance !== 'flat' ? palette : pair === 'core' ? (light ? COASTAL_DAY_FLAT_THEME : PROJECTION_FLAT_THEME) : { ...palette, appearance: 'flat' as const };
  const particleColor = light ? selected.particles.light : selected.particles.dark;
  return <ThemeProvider theme={theme} className="landing-shell" style={{'--ui-font': 'var(--reader-code)', '--ui-font-body': 'var(--reader-body)', '--ui-font-display': 'var(--reader-heading)', '--ui-font-mono': 'var(--reader-code)', ...(hydrated && resolvedTheme ? {} : bootstrapPalette)} as CSSProperties}>
    <header className="landing-nav">
      <a href="/" className="landing-wordmark">Projection UI<span aria-hidden="true">.</span></a>
      <nav aria-label="Main navigation">
        <a href="/docs/">Docs</a><a href="/examples/?path=/story/gallery-components--paired">Gallery</a>
        <details className="landing-theme-picker" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary aria-label="Choose theme" title="Themes" style={{ backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.partner})`, color: palette.primaryFg }}><PaletteIcon /></summary>
          <div className="landing-theme-menu">
            <p>Flexing on you with our themes lol</p>
            <div className="landing-theme-grid" role="group" aria-label="Themes: dark above, light below">
              {(['dark', 'light'] as const).flatMap(mode => (Object.keys(pairs) as (keyof typeof pairs)[]).map(key => {
                const swatch = pairs[key][mode];
                const active = pair === key && light === (mode === 'light');
                return <button key={`${key}-${mode}`} type="button" className="landing-theme-swatch" aria-label={`${swatch.name} (${mode})`} title={`${swatch.name} (${mode})`} aria-pressed={active} style={{ backgroundImage: `linear-gradient(135deg, ${swatch.primary}, ${swatch.partner})`, color: swatch.primaryFg }} onClick={() => { setPair(key); setTheme(mode); }}>
                  {active && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>}
                </button>;
              }))}
            </div>
            <span className="landing-theme-current">{theme.name}</span>
          </div>
        </details>
      </nav>
      <NavLight flat={appearance === 'flat'} color={particleColor} />
    </header>
    <main ref={motionRef} id="nd-page" tabIndex={-1} className="landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <GradientBackground variant="spotlight" className="landing-hero-wash" aria-hidden="true" />
        <div className="landing-copy">
          <GradientText as="h1" id="landing-title">Yes. Another UI library.</GradientText>
          <p className="landing-lead">Take even more effort out of vibe coding.</p>
          <p>React components, glass morphism; all the good stuff. Just give your AI this prompt, we know you&apos;re not gonna read the docs.</p>
          <pre className="landing-ai-prompt" aria-label="AI setup prompt"><code>{AI_PROMPT}</code></pre>
          <div className="landing-actions">
            <Button className="landing-primary landing-glow-button" data-proximity-glow variant="primary" appearance="gradient" style={{padding: '0 18px', fontSize: 14}} onClick={copyPrompt}>Copy AI Prompt</Button>
            <LinkButton className="landing-outline landing-glow-button" data-proximity-glow href="/docs/" style={{background: 'transparent', color: 'var(--ui-accent-text)', borderColor: 'var(--ui-primary)', padding: '0 18px', fontSize: 14}}>Read the docs <ArrowIcon /></LinkButton>
            <a href="/examples/?path=/story/gallery-components--paired">Poke the components</a>
          </div>
          <p className="landing-prompt-status" role="status">{promptStatus}</p>
          <p className="landing-release">Alpha · 0.2.0-next.2 · Candidate</p>
        </div>
        <div className="landing-demo" data-scroll-scene="demo">
          <div className="landing-demo-toolbar"><span>An appetizer while you wait.</span><ButtonGroup aria-label="Preview appearance" value={appearance} onChange={setAppearance} options={[{value:'neon',label:'Modern'},{value:'flat',label:'Flat'}]} /></div>
          <div className="landing-preview"><GradientBackground variant="atmosphere" className="landing-preview-backdrop">
            <Card material="glass" edgeLight underglow className="landing-project-card">
              <div className="landing-card-heading"><div><h2>Your next project</h2><p>Ambition sold separately.</p></div><Avatar alt="Example profile" fallback="UI" size={40} /></div>
              <Input label="Project name" value={project} onChange={event => {setProject(event.currentTarget.value);setSaved(false)}} />
              <div className="landing-progress"><span>Setup progress</span><Badge>In progress</Badge></div>
              <Progress label="Setup progress" value={volume} />
              <Slider label="Manufactured progress" value={volume} onChange={setVolume} />
              <Toggle label="Tell me when things happen" checked={notifications} onChange={setNotifications} />
              <div className="landing-card-actions"><Button className="landing-glow-button" data-proximity-glow appearance="gradient" variant="primary" onClick={() => setSaved(true)} disabled={!project.trim()}>Save project</Button><span role="status">{saved ? 'Saved in this preview.' : 'Go on. It works.'}</span></div>
            </Card>
          </GradientBackground></div>
        </div>
      </section>
      <section className="landing-details" aria-label="What is included">
        <div><h2>Make vibe coding even easier.</h2><p>Quit being so wasteful, your agent is tired of re-coding the same components and styles everywhere.</p><a href="/docs/installation/">Start with installation</a></div>
        <div><h2>Shiiinnnyyyy! <SparkleIcon /></h2><p>Ooey gooey glass and those neon glowing lights, oh my god it&apos;s perfect! Flat styles available, but not advised.</p><a href="/docs/theming/">Explore the themes</a></div>
        <div><h2>Keep up, human.</h2><p>Look, we&apos;re built by agents for agents, we move fast. Keep up with our new hotness if you don&apos;t want to look old and busted.</p><a href="https://github.com/hannasage/projection-ui">Star on GitHub <StarIcon /></a></div>
      </section>
      <section className="landing-last" aria-labelledby="landing-last-title">
        <div data-scroll-scene="closing">
          <GradientText as="h2" id="landing-last-title">Go forth, make incredible things.</GradientText>
          <p>We made a Storybook, go poke around in there if you want to try before you buy.</p>
          <LinkButton className="landing-outline landing-glow-button" data-proximity-glow href="/examples/?path=/story/gallery-components--paired" style={{background: 'transparent', color: 'var(--ui-accent-text)', borderColor: 'var(--ui-primary)', padding: '12px 18px', fontSize: 14}}>Open Storybook <ArrowIcon /></LinkButton>
        </div>
      </section>
    </main>
    <footer className="landing-footer"><div className="landing-footer-inner"><span>Projection UI</span><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href="https://github.com/hannasage/projection-ui">Source</a><a href="/font-licenses/NOTICE.txt">Font licenses</a><a href="/third-party/NOTICE.txt">Graphics license</a></nav><span>Being built to build things that look good.</span></div></footer>
  </ThemeProvider>;
}

function ArrowIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" /></svg>; }
function SparkleIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4M18 4h4" /></svg>; }
function StarIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 2 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9L7.5 7Z" /></svg>; }

function PaletteIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M10 2a8 8 0 1 0 0 16h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.6H15a3 3 0 0 0 3-3.2A8 8 0 0 0 10 2Z" /><path d="M6 6h.01M10 5h.01M14 7h.01M5 10h.01" strokeLinecap="round" strokeWidth="2.5" /></svg>; }
