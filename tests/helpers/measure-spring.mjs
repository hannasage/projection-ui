// Measures a spring with the real Armature solver, through its public entry.
// It follows the method of Armature's own test helper: whole fixed slices, rest limits so small that the solver never stops early,
// the overshoot as the largest value minus 1, and the 2 percent settle time found by linear interpolation between two slices.
import { createSpring, FIXED_STEP, retarget, stepSpring } from '@hannasage/armature';

export const SETTLE_BAND = 0.02;

export const dampingRatio = config => config.damping / (2 * Math.sqrt(config.stiffness * (config.mass ?? 1)));

export function measureSpring(config, seconds = 5) {
  let state = retarget(createSpring({ ...config, restDelta: 1e-9, restSpeed: 1e-9 }, 0), 1);
  const steps = Math.round(seconds / FIXED_STEP);
  let peak = 0;
  let settleAt = null;
  let before = 1;
  for (let i = 1; i <= steps; i++) {
    state = stepSpring(state, 1, FIXED_STEP);
    const miss = Math.abs(state.value - 1);
    if (state.value > peak) peak = state.value;
    if (miss > SETTLE_BAND) settleAt = null;
    else if (settleAt === null) settleAt = i * FIXED_STEP - FIXED_STEP + (FIXED_STEP * (before - SETTLE_BAND)) / (before - miss);
    before = miss;
  }
  if (peak === 0) throw new Error('The curve never moves.');
  if (settleAt === null) throw new Error(`The curve never settles inside ${seconds} seconds.`);
  return { overshoot: Math.max(0, peak - 1), settleSeconds: settleAt };
}

/** The line that docs/motion.md prints for one spring. */
export function springLine(key, config) {
  const measured = measureSpring(config);
  return `- \`${key}\`: stiffness ${config.stiffness}, damping ${config.damping.toFixed(1)}, mass ${config.mass ?? 1}. Damping ratio ${dampingRatio(config).toFixed(3)}. Measured overshoot ${(measured.overshoot * 100).toFixed(1)} percent. Measured settle time ${Math.round(measured.settleSeconds * 1000)} ms.`;
}
