/**
 * Pure math for the Armature page: the spring solver, the measurements, and the chart geometry.
 * Nothing here touches the DOM, so Node can test every function.
 */

/** The solver step. A frame loop keeps the leftover time so the screen rate does not matter. */
export const STEP_SECONDS = 1 / 120;
/** A long pause, such as a hidden tab, advances the spring by this much at most. */
export const MAX_FRAME_SECONDS = 0.1;
/** How long a measurement runs before the spring counts as unsettled. */
export const HORIZON_SECONDS = 8;
/** A spring is settled when it stays within this distance of the target. */
export const SETTLE_BAND = 0.02;

export type SpringParams = { stiffness: number; damping: number; mass: number };
export type SpringPreset = { name: string; params: SpringParams };

export const MECHANICAL: SpringParams = { stiffness: 600, damping: 28, mass: 1 };
export const SETTLE: SpringParams = { stiffness: 600, damping: 48.99, mass: 1 };

export const SPRING_PRESETS: readonly SpringPreset[] = [
  { name: 'Mechanical', params: MECHANICAL },
  { name: 'Settle', params: SETTLE },
  { name: 'Glass press', params: { stiffness: 170, damping: 26, mass: 1 } },
  { name: 'Glass gentle', params: { stiffness: 120, damping: 14, mass: 1 } },
];

export function matchesPreset(preset: SpringPreset, params: SpringParams): boolean {
  return Math.abs(preset.params.stiffness - params.stiffness) < 0.01
    && Math.abs(preset.params.damping - params.damping) < 0.01
    && preset.params.mass === params.mass;
}

/** One semi-implicit Euler step toward a target: velocity first, then position. */
function step(position: number, velocity: number, params: SpringParams, target: number): [number, number] {
  const nextVelocity = velocity + ((-params.stiffness * (position - target) - params.damping * velocity) / params.mass) * STEP_SECONDS;
  return [position + nextVelocity * STEP_SECONDS, nextVelocity];
}

/** Position samples at every step, from rest at 0 toward a target of 1. */
export function simulate(params: SpringParams, seconds: number): number[] {
  let position = 0;
  let velocity = 0;
  const samples = [0];
  const steps = Math.ceil(seconds / STEP_SECONDS);
  for (let index = 0; index < steps; index++) {
    [position, velocity] = step(position, velocity, params, 1);
    samples.push(position);
  }
  return samples;
}

export function dampingRatio(params: SpringParams): number {
  return params.damping / (2 * Math.sqrt(params.stiffness * params.mass));
}

export function naturalFrequency(params: SpringParams): number {
  return Math.sqrt(params.stiffness / params.mass);
}

export type Measurement = {
  samples: number[];
  peak: number;
  overshootPercent: number;
  settled: boolean;
  /** Seconds until the spring stays inside the settle band, or null when it does not settle. */
  settleSeconds: number | null;
};

export function measure(params: SpringParams): Measurement {
  const samples = simulate(params, HORIZON_SECONDS);
  let peak = 0;
  let lastOutside = 0;
  for (let index = 0; index < samples.length; index++) {
    if (samples[index] > peak) peak = samples[index];
    if (Math.abs(samples[index] - 1) > SETTLE_BAND) lastOutside = index + 1;
  }
  const settled = lastOutside < samples.length - 1;
  return {
    samples,
    peak,
    overshootPercent: Math.max(0, peak - 1) * 100,
    settled,
    settleSeconds: settled ? lastOutside * STEP_SECONDS : null,
  };
}

export type Point = readonly [number, number];

const one = (value: number) => value.toFixed(1);

/** A smooth cubic path through the points. */
export function bezierPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  let path = `M${one(points[0][0])} ${one(points[0][1])}`;
  for (let index = 0; index < points.length - 1; index++) {
    const before = points[index - 1] ?? points[index];
    const from = points[index];
    const to = points[index + 1];
    const after = points[index + 2] ?? to;
    path += `C${one(from[0] + (to[0] - before[0]) / 6)} ${one(from[1] + (to[1] - before[1]) / 6)} ${one(to[0] - (after[0] - from[0]) / 6)} ${one(to[1] - (after[1] - from[1]) / 6)} ${one(to[0])} ${one(to[1])}`;
  }
  return path;
}

export type PlotBox = { x: number; y: number; width: number; height: number; yMin: number; yMax: number };

/** Map samples into a plot box and draw them. The path always ends on the last sample in range. */
export function curvePath(samples: readonly number[], seconds: number, box: PlotBox, stride: number): string {
  const toX = (index: number) => box.x + ((index * STEP_SECONDS) / seconds) * box.width;
  const toY = (value: number) => box.y + box.height - ((value - box.yMin) / (box.yMax - box.yMin)) * box.height;
  const last = Math.min(samples.length - 1, Math.ceil(seconds / STEP_SECONDS));
  const points: Point[] = [];
  for (let index = 0; index <= last; index += stride) points.push([toX(index), toY(samples[index])]);
  const end: Point = [toX(last), toY(samples[last])];
  if (points[points.length - 1][0] < end[0] - 0.5) points.push(end);
  return bezierPath(points);
}

export type ChartModel = {
  width: number;
  height: number;
  plot: { left: number; top: number; width: number; height: number };
  seconds: number;
  /** Label size in chart units. A compact chart draws larger labels so they stay readable on a phone. */
  fontSize: number;
  band: { x: number; y: number; width: number; height: number };
  gridLines: { y: number; dashed: boolean }[];
  yLabels: { text: string; x: number; y: number }[];
  xLabels: { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' }[];
  curve: string;
  peak: { x: number; y: number; labelX: number; labelY: number; label: string } | null;
  settle: { x: number; labelX: number; labelY: number } | null;
};

const PLOT = { left: 44, top: 14, width: 580, height: 220 };

/**
 * The chart geometry for one spring. A compact chart suits a narrow screen: the labels are larger,
 * and the settle label sits at the bottom of its line so it cannot touch the peak label.
 */
export function chartModel(params: SpringParams, compact = false): ChartModel {
  const scale = compact ? 1.8 : 1;
  const result = measure(params);
  const seconds = Math.min(6, Math.max(0.5, (result.settleSeconds ?? HORIZON_SECONDS) * 1.3));
  const yMin = -0.05;
  const yMax = Math.max(1.2, result.peak + 0.1);
  const { left, top, width, height } = PLOT;
  const toY = (value: number) => top + height - ((value - yMin) / (yMax - yMin)) * height;
  const peakIndex = result.samples.indexOf(result.peak);
  const peakX = left + ((peakIndex * STEP_SECONDS) / seconds) * width;
  const settleX = result.settleSeconds === null ? 0 : left + (result.settleSeconds / seconds) * width;
  return {
    width: 640,
    height: 280,
    plot: PLOT,
    seconds,
    fontSize: 11 * scale,
    band: { x: left, y: toY(1 + SETTLE_BAND), width, height: toY(1 - SETTLE_BAND) - toY(1 + SETTLE_BAND) },
    gridLines: [{ y: toY(0), dashed: false }, { y: toY(1), dashed: true }],
    yLabels: [{ text: '0', x: left - 8, y: toY(0) + 4 }, { text: '1.0', x: left - 8, y: toY(1) + 4 }],
    xLabels: ([[0, 'start'], [0.5, 'middle'], [1, 'end']] as const).map(([fraction, anchor]) => ({
      text: `${Math.round(seconds * fraction * 1000)} ms`,
      x: left + fraction * width,
      y: top + height + 12 + 10 * scale,
      anchor,
    })),
    curve: curvePath(result.samples, seconds, { x: left, y: top, width, height, yMin, yMax }, 4),
    peak: result.overshootPercent > 0.5
      ? { x: peakX, y: toY(result.peak), labelX: Math.min(peakX + 8, left + width - 70 * scale), labelY: toY(result.peak) - 8, label: `peak +${result.overshootPercent.toFixed(1)}%` }
      : null,
    settle: result.settled ? { x: settleX, labelX: Math.min(settleX + 6, left + width - 80 * scale), labelY: compact ? top + height - 8 : top + 14 } : null,
  };
}

export type GlyphModel = { width: number; height: number; baselineY: number; curve: string };

/** The small curve for the home page card. It draws the first half second of a spring. */
export function glyphModel(params: SpringParams = MECHANICAL): GlyphModel {
  const result = measure(params);
  const box = { x: 8, y: 8, width: 144, height: 94, yMin: -0.05, yMax: 1.2 };
  return {
    width: 160,
    height: 110,
    baselineY: box.y + box.height - ((1 - box.yMin) / (box.yMax - box.yMin)) * box.height,
    curve: curvePath(result.samples, 0.5, box, 3),
  };
}

/** A sentence for people who cannot see the chart. */
export function describeSpring(params: SpringParams): string {
  const result = measure(params);
  const start = 'Position moves from 0 toward a target of 1.';
  const overshoot = result.overshootPercent > 0.5
    ? ` It overshoots the target by ${result.overshootPercent.toFixed(1)} percent, peaking at ${result.peak.toFixed(2)}.`
    : ' It does not overshoot.';
  const settle = result.settleSeconds === null
    ? ' It does not settle within 8 seconds.'
    : ` It stays within 2 percent of the target after ${Math.round(result.settleSeconds * 1000)} milliseconds.`;
  return start + overshoot + settle;
}

export type SpringState = { position: number; velocity: number; carry: number };

const REST_DISTANCE = 0.001;
const REST_SPEED = 0.01;

/**
 * Advance a spring by one display frame. The state keeps the time left over after the last whole
 * step, so 30, 60, and 144 Hz screens end up in the same place. A rest snaps exactly onto the target.
 */
export function advanceSpring(state: SpringState, params: SpringParams, target: number, elapsedSeconds: number): { state: SpringState; resting: boolean } {
  let { position, velocity, carry } = state;
  carry += Math.min(elapsedSeconds, MAX_FRAME_SECONDS);
  while (carry >= STEP_SECONDS) {
    [position, velocity] = step(position, velocity, params, target);
    carry -= STEP_SECONDS;
  }
  if (Math.abs(position - target) < REST_DISTANCE && Math.abs(velocity) < REST_SPEED) {
    return { state: { position: target, velocity: 0, carry: 0 }, resting: true };
  }
  return { state: { position, velocity, carry }, resting: false };
}
