'use client';
import { useEffect, useRef } from 'react';

function palette(light: boolean) {
  return light ? ['#00C8FF', '#369FFF', '#8B75FF'] : ['#C9F53A', '#38E4B2', '#9B7CFF'];
}

/** A disposable, isolated graphics realm leaves every hero control native. */
export function HeroFlow({ flat, light }: { flat: boolean; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const paletteRef = useRef({ colors: palette(light), light });
  useEffect(() => {
    paletteRef.current = { colors: palette(light), light };
    frameRef.current?.contentWindow?.postMessage({ type: 'projection-palette', nonce: frameRef.current.dataset.nonce, ...paletteRef.current }, '*');
  }, [light]);
  useEffect(() => {
    const node = ref.current;
    const hero = node?.closest<HTMLElement>('.landing-hero');
    if (!node || !hero) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    const fine = matchMedia('(any-pointer: fine)');
    let disposed = false, unavailable = false, inView = true, ready = false;
    let idle = 0, timeout = 0, frames = 0;
    let pointer: { x: number; y: number } | null = null;
    const eligible = () => !disposed && !unavailable && !flat && !reduced.matches && !forced.matches && fine.matches && !document.hidden && inView;
    const stop = (state = 'paused') => {
      clearTimeout(idle); clearTimeout(timeout);
      idle = timeout = 0; ready = false; pointer = null;
      frameRef.current?.remove(); frameRef.current = null;
      node.dataset.flowState = state;
    };
    const fail = (detail: unknown) => {
      if (disposed) return;
      unavailable = true; stop('unavailable');
      console.warn('Projection hero graphics are unavailable. Page controls remain available.', detail);
    };
    const sendPointer = () => {
      if (!ready || !pointer) return;
      frameRef.current?.contentWindow?.postMessage({ type: 'projection-move', nonce: frameRef.current.dataset.nonce, ...pointer }, '*');
    };
    const prepare = () => {
      if (!eligible() || frameRef.current || !pointer || node.clientWidth <= 0 || node.clientHeight <= 0) return;
      node.dataset.flowState = 'loading';
      const frame = document.createElement('iframe');
      frame.className = 'landing-flow-canvas'; frame.title = 'Decorative neon tubes';
      frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1; frame.style.cssText = 'width:100%;height:100%;border:0;pointer-events:none;background:transparent';
      frame.dataset.nonce = crypto.randomUUID();
      frame.src = `/effects/tubes-cursor.html#${frame.dataset.nonce}`;
      frameRef.current = frame; node.append(frame);
      timeout = window.setTimeout(() => fail('Graphics initialization timed out'), 15000);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data !== 'object' || event.data.nonce !== frameRef.current?.dataset.nonce) return;
      if (event.data.type === 'projection-ready') {
        frameRef.current?.contentWindow?.postMessage({ type: 'projection-init', nonce: frameRef.current.dataset.nonce, ...paletteRef.current }, '*');
      } else if (event.data.type === 'projection-active') {
        clearTimeout(timeout); timeout = 0; ready = true; node.dataset.flowState = 'active'; sendPointer();
        if (ready) { clearTimeout(idle); idle = window.setTimeout(() => stop('still'), 2500); }
      } else if (event.data.type === 'projection-frame') {
        node.dataset.frames = String(++frames);
      } else if (event.data.type === 'projection-error') fail(event.data.message);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !eligible()) return;
      const box = node.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      prepare(); sendPointer();
      if (ready) { clearTimeout(idle); idle = window.setTimeout(() => stop('still'), 2500); }
    };
    const pause = () => stop('still');
    const sync = () => { if (!eligible()) stop(unavailable ? 'unavailable' : 'paused'); };
    const resize = new ResizeObserver(prepare); resize.observe(node);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting; node.dataset.inView = String(inView); sync();
    });
    observer.observe(hero);
    window.addEventListener('message', receive);
    hero.addEventListener('pointermove', move, { passive: true }); hero.addEventListener('pointerleave', pause);
    document.addEventListener('keydown', pause); document.addEventListener('scroll', pause, { passive: true, capture: true });
    document.addEventListener('visibilitychange', sync);
    for (const media of [reduced, forced, fine]) media.addEventListener('change', sync);
    sync();
    return () => {
      disposed = true; stop(); resize.disconnect(); observer.disconnect();
      window.removeEventListener('message', receive);
      hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', pause);
      document.removeEventListener('keydown', pause); document.removeEventListener('scroll', pause, true);
      document.removeEventListener('visibilitychange', sync);
      for (const media of [reduced, forced, fine]) media.removeEventListener('change', sync);
    };
  }, [flat, light]);
  return <div ref={ref} className="landing-flow" aria-hidden="true" data-flow-state="pending" data-in-view="true" />;
}
