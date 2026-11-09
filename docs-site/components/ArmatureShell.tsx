'use client';
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from 'fumadocs-ui/provider/base';
import { ThemeProvider } from '@hannasage/projection-ui/core';
import '@hannasage/projection-ui/styles';
import { bootstrapPalette, pairs } from './landing-theme';
import { NavLight } from './NavLight';
import { ThemePicker } from './ThemePicker';
import './armature.css';

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** The Armature page frame: the landing nav with its theme menu, the page body, and the footer. */
export function ArmatureShell({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme, theme: colorMode } = useTheme();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [pair, setPair] = useState<keyof typeof pairs>('core');
  const light = hydrated && resolvedTheme === 'light';
  const mode = hydrated && colorMode ? colorMode : 'dark';
  const nextMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark';
  const selected = pairs[pair];
  const palette = light ? selected.light : selected.dark;
  const particleColor = light ? selected.particles.light : selected.particles.dark;
  return <ThemeProvider theme={palette} className="landing-shell armature-shell" style={{ '--ui-font': 'var(--reader-code)', '--ui-font-body': 'var(--reader-body)', '--ui-font-display': 'var(--reader-heading)', '--ui-font-mono': 'var(--reader-code)', ...(hydrated && resolvedTheme ? {} : bootstrapPalette) } as CSSProperties}>
    <header className="landing-nav">
      <a href="/" className="landing-wordmark">Projection UI<span aria-hidden="true">.</span></a>
      <nav aria-label="Main navigation">
        <a href="/docs/">Docs</a><a href="/examples/?path=/story/gallery-components--paired">Gallery</a><a href="/armature/" aria-current="page">Armature</a>
        <ThemePicker pairs={pairs} pair={pair} onPair={setPair} light={light} palette={palette} themeName={palette.name} mode={mode} nextMode={nextMode} onMode={setTheme} />
      </nav>
      <NavLight flat={false} color={particleColor} />
    </header>
    <main id="nd-page" tabIndex={-1} className="landing-main armature-main">{children}</main>
    <footer className="landing-footer"><div className="landing-footer-inner"><span>Projection UI</span><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href="/armature/">Armature</a><a href="https://github.com/hannasage/projection-ui">Source</a><a href="/font-licenses/NOTICE.txt">Font licenses</a><a href="/third-party/NOTICE.txt">Graphics license</a></nav><span>Projection UI and Armature are separate packages. Armature is MIT licensed.</span></div></footer>
  </ThemeProvider>;
}
