'use client';
import { useEffect, useRef } from 'react';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Bounded scroll composition and pointer light, with a fully visible static fallback. */
export function useLandingMotion() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const demo = root.querySelector<HTMLElement>('[data-scroll-scene="demo"]');
    const closing = root.querySelector<HTMLElement>('[data-scroll-scene="closing"]');
    const hero = root.querySelector<HTMLElement>('.landing-hero');
    const last = root.querySelector<HTMLElement>('.landing-last');
    const buttons = [...root.querySelectorAll<HTMLElement>('[data-proximity-glow]')];
    let frame = 0;
    let pointer: { x: number; y: number } | undefined;
    let keyboard = false;
    const reset = () => {
      for (const node of [demo, closing]) { node?.style.removeProperty('transform'); node?.style.removeProperty('opacity'); }
      for (const button of buttons) button.style.setProperty('--button-glow', '0');
    };
    const draw = () => {
      frame = 0;
      if (document.hidden || reduced.matches || forced.matches || keyboard) { reset(); return; }
      // Read static section boxes before writing the moving children's styles.
      const heroBox = hero?.getBoundingClientRect();
      const lastBox = last?.getBoundingClientRect();
      const boxes = pointer && fine.matches ? buttons.map(button => button.getBoundingClientRect()) : [];
      if (demo && heroBox) {
        const progress = innerWidth > 680
          ? clamp(-heroBox.top / Math.max(1, heroBox.height * .55))
          : clamp((innerHeight - heroBox.top - demo.offsetTop) / Math.max(1, Math.min(innerHeight, demo.offsetHeight) * .75));
        const remaining = 1 - progress;
        demo.style.transform = innerWidth > 680
          ? `perspective(1200px) translateY(${16 * remaining}px) rotateX(${2 * remaining}deg) scale(${1 - .015 * remaining})`
          : `translateY(${8 * remaining}px)`;
      }
      if (closing && lastBox) {
        const progress = clamp((innerHeight - lastBox.top) / Math.max(1, innerHeight * .5));
        closing.style.transform = `translateY(${24 * (1 - progress)}px)`;
        closing.style.opacity = String(.82 + .18 * progress);
      }
      buttons.forEach((button, index) => {
        const box = boxes[index];
        if (!pointer || !box || button.matches(':disabled') || box.bottom < 0 || box.top > innerHeight) {
          button.style.setProperty('--button-glow', '0'); return;
        }
        const dx = Math.max(box.left - pointer.x, 0, pointer.x - box.right);
        const dy = Math.max(box.top - pointer.y, 0, pointer.y - box.bottom);
        const intensity = clamp(1 - Math.hypot(dx, dy) / 140);
        button.style.setProperty('--button-glow', String(intensity));
        button.style.setProperty('--button-light-x', `${Math.max(0, Math.min(box.width, pointer.x - box.left))}px`);
        button.style.setProperty('--button-light-y', `${Math.max(0, Math.min(box.height, pointer.y - box.top))}px`);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine.matches) { pointer = undefined; schedule(); return; }
      keyboard = false;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => { pointer = undefined; schedule(); };
    const press = (event: PointerEvent) => { if (event.pointerType !== 'mouse') leave(); };
    const key = () => { keyboard = true; pointer = undefined; schedule(); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    document.addEventListener('pointerdown', press, { passive: true });
    document.addEventListener('keydown', key);
    window.addEventListener('blur', leave);
    document.addEventListener('visibilitychange', schedule);
    for (const media of [reduced, forced, fine]) media.addEventListener('change', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('pointerdown', press);
      document.removeEventListener('keydown', key);
      window.removeEventListener('blur', leave);
      document.removeEventListener('visibilitychange', schedule);
      for (const media of [reduced, forced, fine]) media.removeEventListener('change', schedule);
      reset();
    };
  }, []);
  return ref;
}
