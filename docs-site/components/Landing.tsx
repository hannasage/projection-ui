'use client';
import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useTheme } from 'fumadocs-ui/provider/base';
import { Avatar, Badge, Button, ButtonGroup, Card, GradientBackground, GradientText, Input, LinkButton, Progress, PROJECTION_FLAT_THEME, COASTAL_DAY_FLAT_THEME, Slider, ThemeProvider, Toggle } from '@hannasage/projection-ui/core';
import '@hannasage/projection-ui/styles';
import { NavLight } from './NavLight';
import { useLandingMotion } from './useLandingMotion';
import { useAppearanceAudio } from './useAppearanceAudio';
import { FigmaMark } from './FigmaMark';
import { ThemePicker } from './ThemePicker';
import { bootstrapPalette, pairs } from './landing-theme';
import { SpringGlyph } from './SpringGlyph';
import './armature.css';

const AI_PROMPT = "Oh great AI, take this elite component library and make my project super shiny and cool, like Hanna's projects! Read https://projectionui.dev/docs/ for setup, components, and themes. Then do your thing.";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function Landing() {
  const { resolvedTheme, setTheme, theme: colorMode } = useTheme();
  const motionRef = useLandingMotion();
  const sounds = useAppearanceAudio();
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
  const mode = hydrated && colorMode ? colorMode : 'dark';
  const nextMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark';
  const selected = pairs[pair];
  const palette = light ? selected.light : selected.dark;
  const theme = appearance !== 'flat' ? palette : pair === 'core' ? (light ? COASTAL_DAY_FLAT_THEME : PROJECTION_FLAT_THEME) : { ...palette, appearance: 'flat' as const };
  const particleColor = light ? selected.particles.light : selected.particles.dark;
  return <ThemeProvider theme={theme} className="landing-shell" style={{'--ui-font': 'var(--reader-code)', '--ui-font-body': 'var(--reader-body)', '--ui-font-display': 'var(--reader-heading)', '--ui-font-mono': 'var(--reader-code)', ...(hydrated && resolvedTheme ? {} : bootstrapPalette)} as CSSProperties}>
    <header className="landing-nav">
      <a href="/" className="landing-wordmark">Projection UI<span aria-hidden="true">.</span></a>
      <nav aria-label="Main navigation">
        <a href="/docs/">Docs</a><a href="/examples/?path=/story/gallery-components--paired">Gallery</a><a href="/armature/">Armature</a>
        <ThemePicker pairs={pairs} pair={pair} onPair={setPair} light={light} palette={palette} themeName={theme.name} mode={mode} nextMode={nextMode} onMode={setTheme} />
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
          <p className="landing-release">Beta · 1.0.0-beta.0 · Candidate</p>
        </div>
        <div className="landing-demo" data-scroll-scene="demo">
          <div className="landing-demo-toolbar"><span>An appetizer while you wait.</span><div className="landing-appearance-controls"><ButtonGroup aria-label="Preview appearance" value={appearance} onChange={next => { setAppearance(next); sounds.play(next); }} options={[{value:'neon',label:'Modern'},{value:'flat',label:'Flat'}]} /><button type="button" className="landing-sound-control" aria-label={sounds.active ? 'Mute style sounds' : 'Enable style sounds'} title={sounds.status === 'unavailable' ? 'Style sounds unavailable' : sounds.active ? 'Mute style sounds' : 'Enable style sounds'} data-audio-status={sounds.status} disabled={sounds.status === 'unavailable'} onClick={() => sounds.toggle(appearance)}><SoundIcon active={sounds.active} /></button></div></div>
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
      <section className="landing-figma" aria-labelledby="landing-figma-title">
        <div className="landing-figma-copy">
          <GradientText as="h2" id="landing-figma-title">Design and prototype your layouts first.</GradientText>
          <p>Hop into Figma or (more likely) let your agent hop in and design interfaces first before you file the spec for your coding agents.</p>
        </div>
        <div className="landing-figma-downloads">
          <GradientBackground variant="spotlight" className="landing-figma-tools">
            <FigmaMark flat={appearance === 'flat'} primary={palette.primary} partner={palette.partner} ink={palette.text} light={light} />
            <ul><li>Native components</li><li>Editable text</li><li>Theme variables</li></ul>
            <p>Light and dark. Modern and Flat. Kit 1.0.0-beta.0.</p>
            <div className="landing-actions">
              <LinkButton className="landing-glow-button" data-proximity-glow variant="primary" appearance="gradient" href="/downloads/projection-ui-design-1.0.0-beta.0.zip" download>Download Figma kit <ArrowIcon /></LinkButton>
              <LinkButton className="landing-outline landing-glow-button" data-proximity-glow href="/docs/releases/#editable-figma-kit" style={{ background: 'transparent', color: 'var(--ui-accent-text)', borderColor: 'var(--ui-primary)' }}>Import instructions <ArrowIcon /></LinkButton>
            </div>
            <p className="landing-figma-note">The ZIP is a local importer package, not a .fig file.</p>
          </GradientBackground>
          <a className="landing-figma-guide" href="https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/">Connect Figma to your agent <ArrowIcon /></a>
        </div>
      </section>
      <section className="armature-teaser" aria-labelledby="armature-teaser-title">
        <a className="armature-card" href="/armature/">
          <div className="armature-card-copy">
            <span className="armature-pill"><i aria-hidden="true" />Pre-release</span>
            <h2 id="armature-teaser-title">Armature</h2>
            <p>The physics motion engine built alongside Projection UI. Use it on its own.</p>
            <span className="armature-card-go">See how it moves <ArrowIcon /></span>
          </div>
          <SpringGlyph decorative />
        </a>
      </section>
      <section className="landing-last" aria-labelledby="landing-last-title">
        <div data-scroll-scene="closing">
          <GradientText as="h2" id="landing-last-title">Go forth, make incredible things.</GradientText>
          <p>We made a Storybook, go poke around in there if you want to try before you buy.</p>
          <LinkButton className="landing-outline landing-glow-button" data-proximity-glow href="/examples/?path=/story/gallery-components--paired" style={{background: 'transparent', color: 'var(--ui-accent-text)', borderColor: 'var(--ui-primary)', padding: '12px 18px', fontSize: 14}}>Open Storybook <ArrowIcon /></LinkButton>
        </div>
      </section>
    </main>
    <footer className="landing-footer"><div className="landing-footer-inner"><span>Projection UI</span><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href="/armature/">Armature</a><a href="https://github.com/hannasage/projection-ui">Source</a><a href="/font-licenses/NOTICE.txt">Font licenses</a><a href="/third-party/NOTICE.txt">Graphics license</a></nav><span>Being built to build things that look good.</span></div></footer>
  </ThemeProvider>;
}

function ArrowIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" /></svg>; }
function SparkleIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4M18 4h4" /></svg>; }
function StarIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 2 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9L7.5 7Z" /></svg>; }

function SoundIcon({ active }: { active: boolean }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4Z" />{active ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}</svg>; }
