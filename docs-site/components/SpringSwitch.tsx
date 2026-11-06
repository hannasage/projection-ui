'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { advanceSpring, type SpringParams, type SpringState } from '@/lib/spring-lab';

type SpringSwitchProps = { label: string; params: SpringParams; caption: [string, string] };

/** A switch whose thumb is driven by the lab solver. With reduced motion it snaps. */
export function SpringSwitch({ label, params, caption }: SpringSwitchProps) {
  const [on, setOn] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const live = useRef(params);
  const state = useRef<SpringState>({ position: 0, velocity: 0, carry: 0 });
  const frame = useRef(0);
  const lastTime = useRef(0);
  useEffect(() => { live.current = params; }, [params]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const write = () => button.current?.style.setProperty('--v', state.current.position.toFixed(4));
  const run = (target: number) => {
    const tick = (now: number) => {
      const result = advanceSpring(state.current, live.current, target, (now - lastTime.current) / 1000);
      lastTime.current = now;
      state.current = result.state;
      write();
      frame.current = result.resting ? 0 : requestAnimationFrame(tick);
    };
    if (!frame.current) {
      lastTime.current = performance.now();
      state.current = { ...state.current, carry: 0 };
    } else {
      cancelAnimationFrame(frame.current);
    }
    frame.current = requestAnimationFrame(tick);
  };
  const toggle = () => {
    const next = !on;
    setOn(next);
    const target = next ? 1 : 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      state.current = { position: target, velocity: 0, carry: 0 };
      write();
      return;
    }
    run(target);
  };
  return <div className="armature-switch">
    <button ref={button} type="button" role="switch" aria-checked={on} aria-label={label} style={{ '--v': 0 } as CSSProperties} onClick={toggle} />
    <span>{caption[0]}<br />{caption[1]}</span>
  </div>;
}
