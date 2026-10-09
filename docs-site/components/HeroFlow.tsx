'use client';
import { useEffect, useRef } from 'react';
import type { NeonTubes } from '../lib/neon-tubes';

function palette(light: boolean) {
  return light ? ['#00C8FF', '#369FFF', '#8B75FF'] : ['#C9F53A', '#38E4B2', '#9B7CFF'];
}

/** The hero owns its graphics lifecycle. Content keeps every native input event. */
export function HeroFlow({ flat, light }: { flat: boolean; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<NeonTubes | null>(null);
  const paletteRef = useRef({ colors: palette(light), light });
  useEffect(() => {
    paletteRef.current = { colors: palette(light), light };
    sceneRef.current?.setPalette(paletteRef.current.colors, light);
  }, [light]);
  useEffect(() => {
    const node = ref.current;
    const canvas = node?.querySelector('canvas');
    const hero = node?.closest<HTMLElement>('.landing-hero');
    if (!node || !canvas || !hero) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    let disposed = false;
    let unavailable = false;
    let loading = false;
    let inView = true;
    let keyboardQuiet = false;
    let timer = 0;
    let frames = 0;
    let scene: NeonTubes | null = null;
    const eligible = () => !disposed && !unavailable && !flat && !reduced.matches && !forced.matches && !document.hidden && inView;
    const stop = (state = 'paused') => {
      window.clearTimeout(timer);
      timer = 0;
      scene?.stop();
      node.dataset.flowState = state;
    };
    const start = (duration: number) => {
      if (!eligible() || keyboardQuiet || !scene) return;
      window.clearTimeout(timer);
      scene.start();
      node.dataset.flowState = 'active';
      timer = window.setTimeout(() => stop('still'), duration);
    };
    const releaseScene = () => {
      const current = scene;
      scene = null;
      sceneRef.current = null;
      try { current?.dispose(); }
      catch (error) { console.warn('Projection hero graphics cleanup failed.', error); }
    };
    const fail = (error: unknown) => {
      if (disposed) return;
      unavailable = true;
      stop('unavailable');
      releaseScene();
      console.warn('Projection hero graphics are unavailable. Page controls remain available.', error);
    };
    const prepare = async () => {
      if (!eligible() || scene || loading) return;
      loading = true;
      node.dataset.flowState = 'loading';
      try {
        const { createNeonTubes } = await import('../lib/neon-tubes');
        if (!eligible()) return;
        scene = createNeonTubes(canvas, {
          ...paletteRef.current,
          onFrame: () => { node.dataset.frames = String(++frames); },
          onError: fail,
        });
        sceneRef.current = scene;
        scene.resize(node.clientWidth, node.clientHeight);
        start(4500);
      } catch (error) { fail(error); }
      finally { loading = false; }
    };
    const sync = () => {
      if (!eligible()) stop(unavailable ? 'unavailable' : 'paused');
      else if (!scene) void prepare();
      else if (!keyboardQuiet) start(4500);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !eligible()) return;
      keyboardQuiet = false;
      const box = hero.getBoundingClientRect();
      scene?.move(event.clientX - box.left, event.clientY - box.top);
      start(2500);
    };
    const keyboard = () => { keyboardQuiet = true; stop('still'); };
    const leave = () => stop('still');
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail('WebGL context lost');
    };
    const resize = new ResizeObserver(() => {
      scene?.resize(node.clientWidth, node.clientHeight);
    });
    resize.observe(node);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      node.dataset.inView = String(inView);
      sync();
    });
    observer.observe(hero);
    hero.addEventListener('pointermove', move, { passive: true });
    hero.addEventListener('pointerleave', leave);
    canvas.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('scroll', leave, { passive: true, capture: true });
    document.addEventListener('visibilitychange', sync);
    for (const media of [reduced, forced]) media.addEventListener('change', sync);
    sync();
    return () => {
      disposed = true;
      stop();
      releaseScene();
      resize.disconnect();
      observer.disconnect();
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('webglcontextlost', contextLost);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('scroll', leave, true);
      document.removeEventListener('visibilitychange', sync);
      for (const media of [reduced, forced]) media.removeEventListener('change', sync);
    };
  }, [flat]);
  return <div ref={ref} className="landing-flow" aria-hidden="true" data-flow-state="pending" data-in-view="true">
    <canvas key={flat ? 'flat' : 'modern'} className="landing-flow-canvas" />
  </div>;
}
