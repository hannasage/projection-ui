'use client';
import { useId, useState, useSyncExternalStore } from 'react';
import { Slider } from '@hannasage/projection-ui/core';
import { SPRING_PRESETS, MECHANICAL, SETTLE, dampingRatio, describeSpring, matchesPreset, measure, naturalFrequency, type SpringParams } from '@/lib/spring-lab';
import { SpringChart } from './SpringChart';
import { SpringSwitch } from './SpringSwitch';

const NARROW = '(max-width: 680px)';
const subscribeNarrow = (notify: () => void) => {
  const query = matchMedia(NARROW);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const isNarrow = () => matchMedia(NARROW).matches;
const wideOnServer = () => false;

/** The live spring lab: presets, three sliders, the chart, the equation, four stats, and three switches. */
export function SpringLab() {
  const [params, setParams] = useState<SpringParams>(MECHANICAL);
  const descriptionId = useId();
  const compact = useSyncExternalStore(subscribeNarrow, isNarrow, wideOnServer);
  const result = measure(params);
  const patch = (change: Partial<SpringParams>) => setParams(current => ({ ...current, ...change }));
  const { stiffness, damping, mass } = params;
  return <>
    <div className="armature-lab">
      <div className="armature-chart">
        <SpringChart params={params} describedBy={descriptionId} compact={compact} />
        <p id={descriptionId} className="armature-sr" aria-live="polite">{describeSpring(params)}</p>
        <p className="armature-eq">
          <span aria-hidden="true"><b>{mass.toFixed(1)}</b>&thinsp;x&Prime; + <b>{damping.toFixed(1)}</b>&thinsp;x&prime; + <b>{stiffness.toFixed(0)}</b>&thinsp;x = <b>{stiffness.toFixed(0)}</b></span>
          <span className="armature-sr">{`Equation: mass ${mass.toFixed(1)} times acceleration, plus damping ${damping.toFixed(1)} times velocity, plus stiffness ${stiffness.toFixed(0)} times position, equals ${stiffness.toFixed(0)}.`}</span>
        </p>
        <div className="armature-stats" role="group" aria-label="Measured results">
          <div className="armature-stat">damping ratio<strong>{dampingRatio(params).toFixed(3)}</strong></div>
          <div className="armature-stat">natural frequency<strong>{naturalFrequency(params).toFixed(1)} rad/s</strong></div>
          <div className="armature-stat">overshoot<strong>{result.overshootPercent.toFixed(1)}%</strong></div>
          <div className="armature-stat">settles in<strong>{result.settleSeconds === null ? 'over 8 s' : `${Math.round(result.settleSeconds * 1000)} ms`}</strong></div>
        </div>
      </div>
      <div className="armature-controls">
        <div className="armature-presets" role="group" aria-label="Spring presets">
          {SPRING_PRESETS.map(preset => {
            const pressed = matchesPreset(preset, params);
            return <button key={preset.name} type="button" aria-pressed={pressed} onClick={() => setParams(preset.params)}>{pressed && <span aria-hidden="true">{'\u2713\u00a0'}</span>}{preset.name}</button>;
          })}
        </div>
        <Slider label="stiffness k" min={40} max={1200} step={1} value={stiffness} onChange={value => patch({ stiffness: value })} valueFormat={value => value.toFixed(0)} />
        <Slider label="damping c" min={2} max={90} step={0.5} value={damping} onChange={value => patch({ damping: value })} valueFormat={value => value.toFixed(1)} />
        <Slider label="mass m" min={0.5} max={3} step={0.1} value={mass} onChange={value => patch({ mass: Number(value.toFixed(1)) })} valueFormat={value => value.toFixed(1)} />
      </div>
    </div>
    <div className="armature-demo" role="group" aria-label="Toggle demo">
      <SpringSwitch label="Mechanical toggle" params={MECHANICAL} caption={['Mechanical', '600 / 28']} />
      <SpringSwitch label="Settle toggle" params={SETTLE} caption={['Settle', '600 / 49']} />
      <SpringSwitch label="Your spring toggle" params={params} caption={['Your spring', 'from the sliders']} />
    </div>
  </>;
}
