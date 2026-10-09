'use client';
import { useEffect, useRef, useState } from 'react';
import { createFigmaPoints, projectFigmaPoints, type FigmaCursor } from '../lib/figma-points';

const points = createFigmaPoints();

export function FigmaMark({ flat, primary, partner, ink, light }: { flat: boolean; primary: string; partner: string; ink: string; light: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (flat || !host || !canvas) return;
    const context = (() => { try { return canvas.getContext('2d'); } catch { return null; } })();
    if (!context) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let visible = false;
    let frame = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    let target: { x: number; y: number } | undefined;
    let cursor: FigmaCursor | undefined;
    const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    const start = rgb(primary), end = rgb(partner), foreground = rgb(ink);
    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const point of projectFigmaPoints(points, width, height, phase.current, cursor)) {
        const blend = Math.max(0, Math.min(1, point.y / Math.max(1, height)));
        const color = start.map((value, i) => {
          const hue = value + (end[i] - value) * blend;
          const base = hue * (light ? .62 : .9) + foreground[i] * (light ? .38 : .1);
          // Silver highlights on dark surfaces; stronger saturated ink on light ones.
          const highlight = light ? hue * .45 + foreground[i] * .55 : hue * .45 + 255 * .55;
          return Math.round(base + (highlight - base) * point.glow);
        });
        context.fillStyle = `rgba(${color.join(',')},${point.z > 0 ? .9 : .22})`;
        context.shadowColor = `rgb(${color.join(',')})`;
        context.shadowBlur = point.glow * 5;
        context.beginPath();
        context.arc(point.x, point.y, (point.z > 0 ? .85 : .65) + point.glow * .4, 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
      host.dataset.ready = 'true';
      host.dataset.pointer = cursor && cursor.strength > .01 ? 'active' : 'idle';
    };
    const tick = (time: number) => {
      if (!last) last = time;
      const delta = time - last;
      if (delta >= 32) {
        phase.current += Math.min(delta, 50) / 1000;
        const follow = 1 - Math.exp(-Math.min(delta, 50) / 90);
        if (target && !cursor) cursor = { ...target, strength: 0 };
        if (cursor) {
          cursor.x += ((target?.x ?? cursor.x) - cursor.x) * follow;
          cursor.y += ((target?.y ?? cursor.y) - cursor.y) * follow;
          cursor.strength += ((target ? 1 : 0) - cursor.strength) * follow;
          if (!target && cursor.strength < .001) cursor = undefined;
        }
        last = time;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      const allowed = !reduced.matches && !forced.matches;
      target = undefined;
      cursor = undefined;
      setMotionAllowed(allowed);
      host.dataset.motion = forced.matches || reduced.matches ? 'still' : paused ? 'paused' : document.hidden || !visible ? 'offscreen' : 'running';
      if (forced.matches) { delete host.dataset.ready; return; }
      if (width && height) draw();
      if (allowed && !paused && visible && !document.hidden && width && height) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine.matches || paused || reduced.matches || forced.matches || document.hidden || !visible || (event.target as Element).closest('button')) {
        clearPointer(); return;
      }
      const bounds = host.getBoundingClientRect();
      target = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const leave = () => { target = undefined; };
    const clearPointer = () => {
      const hadCursor = Boolean(cursor);
      target = undefined;
      cursor = undefined;
      host.dataset.pointer = 'idle';
      if (hadCursor && width && height && visible && !document.hidden && !forced.matches) draw();
    };
    const resize = new ResizeObserver(() => {
      width = host.clientWidth;
      height = host.clientHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      sync();
    });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    resize.observe(host);
    observer.observe(host);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    forced.addEventListener('change', sync);
    fine.addEventListener('change', clearPointer);
    host.addEventListener('pointermove', move, { passive: true });
    host.addEventListener('pointerleave', leave);
    host.addEventListener('pointerdown', move, { passive: true });
    document.addEventListener('keydown', clearPointer);
    window.addEventListener('blur', clearPointer);
    window.addEventListener('scroll', clearPointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
      forced.removeEventListener('change', sync);
      fine.removeEventListener('change', clearPointer);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointerdown', move);
      document.removeEventListener('keydown', clearPointer);
      window.removeEventListener('blur', clearPointer);
      window.removeEventListener('scroll', clearPointer);
      delete host.dataset.ready;
      delete host.dataset.motion;
      delete host.dataset.pointer;
    };
  }, [flat, primary, partner, ink, light, paused]);
  return <div className="figma-mark-stage" ref={hostRef} data-flat={flat}>
    {!flat && <canvas ref={canvasRef} className="figma-point-cloud" aria-hidden="true" />}
    <svg className="landing-figma-mark" viewBox="-3 -3 126 186" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M60 0H30a30 30 0 0 0 0 60h30Z" /><path d="M60 0h30a30 30 0 0 1 0 60H60Z" />
      <path d="M60 60H30a30 30 0 0 0 0 60h30Z" /><circle cx="90" cy="90" r="30" />
      <path d="M60 120H30a30 30 0 1 0 30 30Z" />
    </svg>
    {!flat && motionAllowed && <button type="button" className="figma-motion-control" aria-label={paused ? 'Resume logo motion' : 'Pause logo motion'} onClick={() => setPaused(value => !value)}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{paused ? <path d="m5 3 8 5-8 5Z" /> : <path d="M5 3v10M11 3v10" />}</svg>
    </button>}
  </div>;
}
