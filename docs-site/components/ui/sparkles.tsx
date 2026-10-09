'use client';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import type { Container, Engine, ISourceOptions } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';

// The current React adapter initializes its engine through a stable provider.
async function initialize(engine: Engine) {
  try { await loadSlim(engine); }
  catch (error) { console.warn('Navbar sparkles could not initialize; static underglow remains.', error); throw error; }
}

export function SparklesCore({ particleColor }: { particleColor: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const container = useRef<Container | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; container.current?.destroy(); container.current = undefined; };
  }, []);
  const loaded = useCallback((value?: Container) => {
    if (!mounted.current) { value?.destroy(); return; }
    container.current = value;
    if (value && ref.current) ref.current.dataset.sparklesState = 'active';
  }, []);
  const options = useMemo<ISourceOptions>(() => ({
    background: { color: { value: 'transparent' } },
    fullScreen: { enable: false },
    fpsLimit: 30,
    detectRetina: false,
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
    interactivity: { events: { onClick: { enable: false }, onHover: { enable: false } } },
    particles: {
      color: { value: particleColor },
      number: { value: 54, density: { enable: false } },
      shape: { type: 'circle' },
      links: { enable: false },
      collisions: { enable: false },
      move: { enable: true, direction: 'bottom', straight: true, speed: { min: .18, max: .55 }, outModes: { default: 'out' } },
      opacity: { value: { min: .15, max: .75 }, animation: { enable: true, speed: .45, sync: false } },
      size: { value: { min: .4, max: 1.25 } },
    },
  }), [particleColor]);
  return <div ref={ref} className="nav-sparkles" data-sparkles-state="loading">
    <ParticlesProvider init={initialize}><Particles id={`nav-sparkles-${id}`} options={options} particlesLoaded={loaded} /></ParticlesProvider>
  </div>;
}
