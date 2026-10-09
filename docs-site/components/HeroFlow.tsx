'use client';
import { useEffect, useId, useRef } from 'react';

type Point = { x: number; y: number };

/** A mouse-drawn light ribbon. Its bounded frame loop stops after the trail fades. */
export function HeroFlow({ flat }: { flat: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const gradient = useId().replaceAll(':', '');
  useEffect(() => {
    const node = ref.current;
    const hero = node?.closest<HTMLElement>('.landing-hero');
    const svg = node?.querySelector<SVGSVGElement>('.landing-flow-canvas');
    const trail = node?.querySelector<SVGGElement>('.landing-flow-trail');
    const paths = node?.querySelectorAll<SVGPathElement>('[data-trail-path]');
    if (!node || !hero || !svg || !trail || !paths) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    const fine = matchMedia('(pointer: fine)');
    const points: Point[] = [];
    const target: Point = { x: 0, y: 0 };
    let inView = true;
    let frame = 0;
    let lastFrame = 0;
    let lastMove = 0;
    const allowed = () => !flat && !reduced.matches && !forced.matches && fine.matches && !document.hidden && inView;
    const clear = (state: 'idle' | 'paused') => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      points.length = 0;
      trail.style.opacity = '0';
      for (const path of paths) path.setAttribute('d', '');
      node.dataset.trailState = state;
    };
    const sync = () => {
      const active = allowed();
      node.dataset.active = String(active);
      if (!active) clear('paused');
      else if (node.dataset.trailState === 'paused') node.dataset.trailState = 'idle';
    };
    const resize = new ResizeObserver(() => {
      svg.setAttribute('viewBox', `0 0 ${Math.max(1, hero.clientWidth)} ${Math.max(1, hero.clientHeight)}`);
      clear(allowed() ? 'idle' : 'paused');
    });
    resize.observe(hero);
    const observe = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      node.dataset.inView = String(inView);
      sync();
    });
    observe.observe(hero);
    const draw = (now: number) => {
      frame = 0;
      if (!allowed()) { clear('paused'); return; }
      const age = now - lastMove;
      if (age >= 800) { clear('idle'); return; }
      const delta = Math.min(40, lastFrame ? now - lastFrame : 16.67);
      lastFrame = now;
      const headFollow = 1 - Math.exp(-delta / 28);
      const tailFollow = 1 - Math.exp(-delta / 52);
      for (let i = 0; i < points.length; i++) {
        const leader = i === 0 ? target : points[i - 1];
        const follow = i === 0 ? headFollow : tailFollow;
        points[i].x += (leader.x - points[i].x) * follow;
        points[i].y += (leader.y - points[i].y) * follow;
      }
      // Quadratic midpoints make a continuous ribbon through the lagging points.
      const tail = points[points.length - 1];
      let geometry = `M ${tail.x.toFixed(2)} ${tail.y.toFixed(2)}`;
      for (let i = points.length - 2; i > 0; i--) {
        const point = points[i];
        const next = points[i - 1];
        geometry += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${((point.x + next.x) / 2).toFixed(2)} ${((point.y + next.y) / 2).toFixed(2)}`;
      }
      geometry += ` L ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
      for (const path of paths) path.setAttribute('d', geometry);
      trail.style.opacity = String(Math.max(0, 1 - Math.max(0, age - 180) / 620));
      frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !allowed()) { clear(allowed() ? 'idle' : 'paused'); return; }
      const box = hero.getBoundingClientRect();
      target.x = Math.max(0, Math.min(box.width, event.clientX - box.left));
      target.y = Math.max(0, Math.min(box.height, event.clientY - box.top));
      if (!points.length) for (let i = 0; i < 14; i++) points.push({ ...target });
      lastMove = performance.now();
      node.dataset.trailState = 'moving';
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const reset = () => clear(allowed() ? 'idle' : 'paused');
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', reset);
    document.addEventListener('keydown', reset);
    document.addEventListener('scroll', reset, { passive: true, capture: true });
    document.addEventListener('visibilitychange', sync);
    for (const media of [reduced, forced, fine]) media.addEventListener('change', sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observe.disconnect();
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', reset);
      document.removeEventListener('keydown', reset);
      document.removeEventListener('scroll', reset, true);
      document.removeEventListener('visibilitychange', sync);
      for (const media of [reduced, forced, fine]) media.removeEventListener('change', sync);
    };
  }, [flat]);
  return <div ref={ref} className="landing-flow" aria-hidden="true" data-active="false" data-in-view="true" data-trail-state="idle">
    <svg className="landing-flow-rest" viewBox="0 0 1200 600" preserveAspectRatio="none" focusable="false">
      <defs><linearGradient id={`${gradient}-rest`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100%" y2="0"><stop stopColor="var(--ui-primary)" /><stop offset="1" stopColor="var(--ui-partner)" /></linearGradient></defs>
      <g fill="none" stroke={`url(#${gradient}-rest)`} strokeLinecap="round">
        <path className="landing-flow-rest-bloom" d="M -160 550 C 380 540 440 190 840 180 S 1160 250 1380 40" />
        <path className="landing-flow-rest-core" d="M -160 550 C 380 540 440 190 840 180 S 1160 250 1380 40" />
      </g>
    </svg>
    <svg className="landing-flow-canvas" viewBox="0 0 1200 740" preserveAspectRatio="none" focusable="false">
      <defs><linearGradient id={`${gradient}-trail`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100%" y2="0"><stop stopColor="var(--ui-partner)" /><stop offset="1" stopColor="var(--ui-primary)" /></linearGradient></defs>
      <g className="landing-flow-trail" fill="none" stroke={`url(#${gradient}-trail)`} strokeLinecap="round" strokeLinejoin="round" opacity="0">
        <path data-trail-path="bloom" className="landing-flow-trail-bloom" />
        <path data-trail-path="body" className="landing-flow-trail-body" />
        <path data-trail-path="core" className="landing-flow-trail-core" />
      </g>
    </svg>
  </div>;
}
