/**
 * Pure math for the Armature page: the spring solver, the measurements, and the chart geometry.
 * Nothing here touches the DOM, so Node can test every function.
 */

/** The solver step. A frame loop keeps the leftover time so the screen rate does not matter. */
export const STEP_SECONDS = 1 / 120;
/** The smallest step, so a huge stiffness cannot make a frame run forever. */
export const MIN_STEP_SECONDS = 1 / 20_000;
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

/** The slider ranges. Every public function keeps its input inside them. */
export const LIMITS = {
  stiffness: { min: 40, max: 1200 },
  damping: { min: 2, max: 90 },
  mass: { min: 0.5, max: 3 },
} as const;

const keep = (value: number | undefined, range: { min: number; max: number }, fallback: number): number =>
  typeof value !== 'number' || Number.isNaN(value) ? fallback : Math.min(range.max, Math.max(range.min, value));

/** Clamp a spring to the slider ranges. A missing or NaN value becomes the Mechanical value. */
export function clampParams(params: Partial<SpringParams>): SpringParams {
  return {
    stiffness: keep(params.stiffness, LIMITS.stiffness, MECHANICAL.stiffness),
    damping: keep(params.damping, LIMITS.damping, MECHANICAL.damping),
    mass: keep(params.mass, LIMITS.mass, MECHANICAL.mass),
  };
}

/**
 * The step this spring uses. It is the same rule as the Armature package:
 * at most 1/120 second, and smaller when the spring is stiff or heavily damped so it stays stable.
 */
export function stepSeconds(input: SpringParams): number {
  const params = clampParams(input);
  const rate = Math.max(Math.sqrt(params.stiffness / params.mass), params.damping / params.mass);
  return Math.min(STEP_SECONDS, Math.max(MIN_STEP_SECONDS, 1 / rate));
}

export function matchesPreset(preset: SpringPreset, params: SpringParams): boolean {
  return Math.abs(preset.params.stiffness - params.stiffness) < 0.01
    && Math.abs(preset.params.damping - params.damping) < 0.01
    && preset.params.mass === params.mass;
}

/** One semi-implicit Euler step toward a target: velocity first, then position. */
function step(position: number, velocity: number, params: SpringParams, target: number, slice: number): [number, number] {
  const nextVelocity = velocity + ((-params.stiffness * (position - target) - params.damping * velocity) / params.mass) * slice;
  return [position + nextVelocity * slice, nextVelocity];
}

/** Position samples at every step of this spring, from rest at 0 toward a target of 1. */
export function simulate(input: SpringParams, seconds: number): number[] {
  const params = clampParams(input);
  const slice = stepSeconds(params);
  let position = 0;
  let velocity = 0;
  const samples = [0];
  const steps = Math.ceil((Number.isFinite(seconds) ? Math.max(0, seconds) : 0) / slice);
  for (let index = 0; index < steps; index++) {
    [position, velocity] = step(position, velocity, params, 1, slice);
    samples.push(position);
  }
  return samples;
}

export function dampingRatio(input: SpringParams): number {
  const params = clampParams(input);
  return params.damping / (2 * Math.sqrt(params.stiffness * params.mass));
}

export function naturalFrequency(input: SpringParams): number {
  const params = clampParams(input);
  return Math.sqrt(params.stiffness / params.mass);
}

export type Measurement = {
  samples: number[];
  /** Seconds between two samples. */
  stepSeconds: number;
  peak: number;
  overshootPercent: number;
  settled: boolean;
  /** Seconds until the spring stays inside the settle band, or null when it does not settle. */
  settleSeconds: number | null;
};

export function measure(input: SpringParams): Measurement {
  const slice = stepSeconds(input);
  const samples = simulate(input, HORIZON_SECONDS);
  let peak = 0;
  let lastOutside = 0;
  for (let index = 0; index < samples.length; index++) {
    if (samples[index] > peak) peak = samples[index];
    if (Math.abs(samples[index] - 1) > SETTLE_BAND) lastOutside = index + 1;
  }
  const settled = lastOutside < samples.length - 1;
  return {
    samples,
    stepSeconds: slice,
    peak,
    overshootPercent: Math.max(0, peak - 1) * 100,
    settled,
    settleSeconds: settled ? lastOutside * slice : null,
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
export function curvePath(samples: readonly number[], seconds: number, box: PlotBox, stride: number, slice = STEP_SECONDS): string {
  const toX = (index: number) => box.x + ((index * slice) / seconds) * box.width;
  const toY = (value: number) => box.y + box.height - ((value - box.yMin) / (box.yMax - box.yMin)) * box.height;
  const last = Math.min(samples.length - 1, Math.ceil(seconds / slice));
  const points: Point[] = [];
  for (let index = 0; index <= last; index += stride) points.push([toX(index), toY(samples[index])]);
  const end: Point = [toX(last), toY(samples[last])];
  if (points[points.length - 1][0] < end[0] - 0.5) points.push(end);
  return bezierPath(points);
}

export type ChartLabel = { text: string; x: number; y: number };

export type ChartModel = {
  width: number;
  height: number;
  plot: { left: number; top: number; width: number; height: number };
  seconds: number;
  /** Label size in chart units. */
  fontSize: number;
  /** The plus or minus 2 percent band, with its edge drawn by the view and a text label. */
  band: { x: number; y: number; width: number; height: number; label: ChartLabel & { anchor: 'end' } };
  gridLines: { y: number; dashed: boolean }[];
  yLabels: ChartLabel[];
  xLabels: (ChartLabel & { anchor: 'start' | 'middle' | 'end' })[];
  curve: string;
  peak: { x: number; y: number; labelX: number; labelY: number; label: string; anchor: 'start' | 'end' } | null;
  settle: { x: number; labelX: number; labelY: number } | null;
};

type Layout = { width: number; height: number; left: number; top: number; plotWidth: number; plotHeight: number; fontSize: number };

/** A wide chart for desktop and a taller, larger-labelled chart for a phone. */
const WIDE: Layout = { width: 640, height: 226, left: 44, top: 14, plotWidth: 580, plotHeight: 166, fontSize: 11 };
const COMPACT: Layout = { width: 480, height: 360, left: 52, top: 16, plotWidth: 416, plotHeight: 296, fontSize: 17 };

/** A label's width in chart units, for a monospace face. */
const labelWidth = (text: string, fontSize: number) => text.length * fontSize * 0.6;

/** How many seconds the chart spans: the settle time plus a margin, kept between half a second and six. */
function chartSeconds(result: Measurement): number {
  return Math.min(6, Math.max(0.5, (result.settleSeconds ?? HORIZON_SECONDS) * 1.3));
}

/**
 * The chart geometry for one spring. A compact chart suits a narrow screen: it is about four to three,
 * its labels are larger, and the settle label sits at the bottom of its line so it cannot touch the peak label.
 */
export function chartModel(input: SpringParams, compact = false): ChartModel {
  const params = clampParams(input);
  const result = measure(params);
  const layout = compact ? COMPACT : WIDE;
  const { left, top, fontSize } = layout;
  const width = layout.plotWidth;
  const height = layout.plotHeight;
  const right = left + width;
  const seconds = chartSeconds(result);
  const yMin = -0.05;
  const yMax = Math.max(1.2, result.peak + 0.1);
  const toY = (value: number) => top + height - ((value - yMin) / (yMax - yMin)) * height;
  const peakIndex = result.samples.indexOf(result.peak);
  const peakX = left + ((peakIndex * result.stepSeconds) / seconds) * width;
  const settleX = result.settleSeconds === null ? 0 : left + (result.settleSeconds / seconds) * width;
  const gap = fontSize * 0.75;
  const bandBottom = toY(1 - SETTLE_BAND);
  const peakLabel = `peak +${result.overshootPercent.toFixed(1)}%`;
  const stride = Math.max(1, Math.round((4 * STEP_SECONDS) / result.stepSeconds));
  // The peak label sits right of the peak. When that would cross the settle line, it sits left of the peak.
  const peakMark = () => {
    const wide = Math.max(70, labelWidth(peakLabel, fontSize) + 4);
    const crossesSettle = result.settled && peakX + 8 + wide > settleX - 4;
    const base = { x: peakX, y: toY(result.peak), labelY: toY(result.peak) - gap, label: peakLabel };
    return crossesSettle && peakX - 8 - wide >= left
      ? { ...base, labelX: peakX - 8, anchor: 'end' as const }
      : { ...base, labelX: Math.min(peakX + 8, right - wide), anchor: 'start' as const };
  };
  return {
    width: layout.width,
    height: layout.height,
    plot: { left, top, width, height },
    seconds,
    fontSize,
    band: {
      x: left,
      y: toY(1 + SETTLE_BAND),
      width,
      height: bandBottom - toY(1 + SETTLE_BAND),
      label: { text: '2% band', x: right, y: bandBottom + fontSize + 3, anchor: 'end' },
    },
    gridLines: [{ y: toY(0), dashed: false }, { y: toY(1), dashed: true }],
    yLabels: [{ text: '0', x: left - 8, y: toY(0) + fontSize * 0.35 }, { text: '1.0', x: left - 8, y: toY(1) + fontSize * 0.35 }],
    xLabels: ([[0, 'start'], [0.5, 'middle'], [1, 'end']] as const).map(([fraction, anchor]) => ({
      text: `${Math.round(seconds * fraction * 1000)} ms`,
      x: left + fraction * width,
      y: top + height + fontSize + 11,
      anchor,
    })),
    curve: curvePath(result.samples, seconds, { x: left, y: top, width, height, yMin, yMax }, stride, result.stepSeconds),
    peak: result.overshootPercent > 0.5 ? peakMark() : null,
    settle: result.settled
      ? {
        x: settleX,
        labelX: Math.min(settleX + 6, right - Math.max(80, labelWidth('settled', fontSize) + 4)),
        labelY: compact ? top + height - gap : top + 14,
      }
      : null,
  };
}

export type GlyphModel = { width: number; height: number; baselineY: number; curve: string; label: ChartLabel };

/** The small curve for the home page card. It draws the first half second of a spring. */
export function glyphModel(params: SpringParams = MECHANICAL): GlyphModel {
  const result = measure(params);
  const box = { x: 8, y: 8, width: 144, height: 94, yMin: -0.05, yMax: 1.2 };
  const baselineY = box.y + box.height - ((1 - box.yMin) / (box.yMax - box.yMin)) * box.height;
  return {
    width: 160,
    height: 110,
    baselineY,
    curve: curvePath(result.samples, 0.5, box, Math.max(1, Math.round((3 * STEP_SECONDS) / result.stepSeconds)), result.stepSeconds),
    label: { text: '1.0', x: 8, y: baselineY - 4 },
  };
}

/** A sentence for people who cannot see the chart. */
export function describeSpring(params: SpringParams): string {
  const result = measure(params);
  const start = 'Position moves from 0 toward a target of 1.';
  const span = ` The chart spans 0 to ${Math.round(chartSeconds(result) * 1000)} ms.`;
  const overshoot = result.overshootPercent > 0.5
    ? ` It overshoots the target by ${result.overshootPercent.toFixed(1)} percent, peaking at ${result.peak.toFixed(2)}.`
    : ' It does not overshoot.';
  const settle = result.settleSeconds === null
    ? ' It does not settle within 8 seconds.'
    : ` It stays within 2 percent of the target after ${Math.round(result.settleSeconds * 1000)} milliseconds.`;
  return start + span + overshoot + settle;
}

export type SpringState = { position: number; velocity: number; carry: number };

const REST_DISTANCE = 0.001;
const REST_SPEED = 0.01;

/**
 * Advance a spring by one display frame. The state keeps the time left over after the last whole
 * step, so 30, 60, and 144 Hz screens end up in the same place. A rest snaps exactly onto the target.
 * A negative or non-finite elapsed time counts as zero.
 */
export function advanceSpring(state: SpringState, input: SpringParams, target: number, elapsedSeconds: number): { state: SpringState; resting: boolean } {
  const params = clampParams(input);
  const slice = stepSeconds(params);
  let { position, velocity, carry } = state;
  carry += Number.isFinite(elapsedSeconds) ? Math.min(Math.max(0, elapsedSeconds), MAX_FRAME_SECONDS) : 0;
  while (carry >= slice) {
    [position, velocity] = step(position, velocity, params, target, slice);
    carry -= slice;
  }
  if (Math.abs(position - target) < REST_DISTANCE && Math.abs(velocity) < REST_SPEED) {
    return { state: { position: target, velocity: 0, carry: 0 }, resting: true };
  }
  return { state: { position, velocity, carry }, resting: false };
}
