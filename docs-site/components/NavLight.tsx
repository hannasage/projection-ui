'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const Sparkles = dynamic(() => import('./ui/sparkles').then(module => module.SparklesCore), { ssr: false });

export function NavLight({ flat, light }: { flat: boolean; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    let visible = true;
    const sync = () => {
      const allowed = !reduced.matches && !forced.matches;
      setMotionAllowed(allowed);
      setEligible(allowed && visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    forced.addEventListener('change', sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      forced.removeEventListener('change', sync);
    };
  }, []);
  return <>
    <div ref={ref} className="nav-light" aria-hidden="true">
      {!flat && !paused && eligible && <Sparkles key={light ? 'light' : 'dark'} particleColor={light ? '#159BEA' : '#D8FF87'} />}
    </div>
    {!flat && motionAllowed && <button type="button" className="landing-motion-control" aria-label={paused ? 'Resume sparkles' : 'Pause sparkles'} onClick={() => setPaused(value => !value)}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{paused ? <path d="m5 3 8 5-8 5Z" /> : <path d="M5 3v10M11 3v10" />}</svg>
    </button>}
  </>;
}
