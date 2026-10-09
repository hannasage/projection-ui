'use client';
import { useEffect, useId, useRef } from 'react';

/** A local, finite light study. Pointer response never captures the page gesture. */
export function HeroFlow({ flat }: { flat: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const gradient = useId().replaceAll(':', '');
  useEffect(() => {
    const node = ref.current;
    const hero = node?.closest<HTMLElement>('.landing-hero');
    const pointer = node?.querySelector<SVGGElement>('.landing-flow-pointer');
    if (!node || !hero || !pointer) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    const fine = matchMedia('(pointer: fine)');
    let inView = true;
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => { pointer.style.transform = ''; };
    const sync = () => {
      const allowed = !flat && !reduced.matches && !forced.matches && !document.hidden && inView;
      node.dataset.active = String(allowed);
      if (!allowed) { cancelAnimationFrame(frame); frame = 0; reset(); }
    };
    const observe = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      node.dataset.inView = String(inView);
      sync();
    });
    observe.observe(hero);
    const move = (event: PointerEvent) => {
      if (node.dataset.active !== 'true' || !fine.matches || event.pointerType === 'touch') return;
      const box = hero.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1)) * 10;
      y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1)) * 6;
      if (!frame) frame = requestAnimationFrame(() => {
        pointer.style.transform = `translate(${x}px, ${y}px)`;
        frame = 0;
      });
    };
    const leave = () => { cancelAnimationFrame(frame); frame = 0; reset(); };
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', sync);
    for (const media of [reduced, forced, fine]) media.addEventListener('change', sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observe.disconnect();
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', sync);
      for (const media of [reduced, forced, fine]) media.removeEventListener('change', sync);
    };
  }, [flat]);
  return <div ref={ref} className="landing-flow" aria-hidden="true" data-active="false" data-in-view="true">
    <svg viewBox="0 0 1200 740" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop stopColor="var(--ui-primary)" /><stop offset="1" stopColor="var(--ui-partner)" /></linearGradient></defs>
      <g className="landing-flow-pointer"><g className="landing-flow-drift" fill="none" stroke={`url(#${gradient})`} strokeLinecap="round">
        <path className="landing-flow-soft" d="M 120 730 C 480 660 440 310 770 270 S 1100 520 1280 120" />
        <path className="landing-flow-ribbon" d="M 120 730 C 480 660 440 310 770 270 S 1100 520 1280 120" />
        <path className="landing-flow-line" d="M 40 750 C 500 670 430 340 780 300 S 1080 560 1260 170" />
        <path className="landing-flow-thread" d="M 270 790 C 580 670 530 420 850 370 S 1120 600 1320 240" />
      </g></g>
    </svg>
  </div>;
}
