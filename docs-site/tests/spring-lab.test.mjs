import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STEP_SECONDS, MAX_FRAME_SECONDS, SPRING_PRESETS, MECHANICAL,
  simulate, measure, dampingRatio, naturalFrequency, matchesPreset,
  bezierPath, curvePath, chartModel, glyphModel, describeSpring, advanceSpring,
} from '../lib/spring-lab.ts';

const spring = (stiffness, damping, mass = 1) => ({ stiffness, damping, mass });

test('the lab uses a fixed step of 1/120 second', () => {
  assert.equal(STEP_SECONDS, 1 / 120);
  assert.equal(MAX_FRAME_SECONDS, 0.1);
});

test('simulate returns one sample per step, starting at rest at zero', () => {
  const samples = simulate(spring(600, 28), 1);
  assert.equal(samples.length, 121);
  assert.equal(samples[0], 0);
  assert.ok(samples[1] > 0 && samples[1] < 0.1);
});

test('simulate rounds a partial step up so the span is always covered', () => {
  assert.equal(simulate(spring(600, 28), 0.5).length, 61);
  assert.equal(simulate(spring(600, 28), 0.504).length, 62);
});

test('a critically damped spring approaches the target without crossing it', () => {
  const samples = simulate(spring(600, 48.99), 3);
  assert.ok(samples.every(value => value <= 1 + 1e-9));
  assert.ok(Math.abs(samples.at(-1) - 1) < 1e-6);
});

test('the Mechanical spring measures about nine percent overshoot', () => {
  const result = measure(spring(600, 28, 1));
  assert.ok(result.overshootPercent >= 8.5 && result.overshootPercent <= 9.5, `overshoot ${result.overshootPercent}`);
  assert.ok(Math.abs(dampingRatio(spring(600, 28, 1)) - 0.572) < 0.01);
});

test('the Mechanical spring settles between 200 and 250 milliseconds', () => {
  const result = measure(spring(600, 28, 1));
  assert.equal(result.settled, true);
  const milliseconds = result.settleSeconds * 1000;
  assert.ok(milliseconds >= 200 && milliseconds <= 250, `settle ${milliseconds} ms`);
});

test('stiffness 600 with damping 30 measures between 6 and 7 percent overshoot', () => {
  const result = measure(spring(600, 30, 1));
  assert.ok(result.overshootPercent >= 6 && result.overshootPercent <= 7, `overshoot ${result.overshootPercent}`);
});

test('stiffness 600 with damping 48.99 measures at most half a percent overshoot', () => {
  const result = measure(spring(600, 48.99, 1));
  assert.ok(result.overshootPercent <= 0.5, `overshoot ${result.overshootPercent}`);
});

test('a spring that never settles inside the horizon says so', () => {
  const result = measure(spring(1200, 2, 3));
  assert.equal(result.settled, false);
  assert.equal(result.settleSeconds, null);
});

test('damping ratio and natural frequency follow the textbook formulas', () => {
  assert.ok(Math.abs(dampingRatio(spring(100, 20, 1)) - 1) < 1e-12);
  assert.ok(Math.abs(dampingRatio(spring(400, 20, 4)) - 20 / (2 * Math.sqrt(1600))) < 1e-12);
  assert.ok(Math.abs(naturalFrequency(spring(400, 20, 4)) - 10) < 1e-12);
});

test('presets include the two named springs and match by value', () => {
  const names = SPRING_PRESETS.map(preset => preset.name);
  assert.deepEqual(names, ['Mechanical', 'Settle', 'Glass press', 'Glass gentle']);
  assert.deepEqual(SPRING_PRESETS[0].params, MECHANICAL);
  assert.equal(matchesPreset(SPRING_PRESETS[1], spring(600, 48.99, 1)), true);
  assert.equal(matchesPreset(SPRING_PRESETS[1], spring(600, 49.5, 1)), false);
  assert.equal(matchesPreset(SPRING_PRESETS[0], spring(600, 28, 1.1)), false);
});

test('bezierPath draws one cubic segment between each pair of points', () => {
  assert.equal(bezierPath([[1, 2]]), 'M1.0 2.0');
  const path = bezierPath([[0, 0], [10, 10], [20, 0]]);
  assert.match(path, /^M0\.0 0\.0C/);
  assert.equal(path.split('C').length - 1, 2);
  assert.ok(path.endsWith('20.0 0.0'));
  assert.deepEqual(bezierPath([]), '');
});

test('curvePath ends on the final sample even when the stride skips it', () => {
  const samples = simulate(spring(600, 28), 0.5);
  const box = { x: 0, y: 0, width: 100, height: 50, yMin: 0, yMax: 1.2 };
  const path = curvePath(samples, 0.5, box, 7);
  const match = path.match(/([\d.]+) ([\d.]+)$/);
  assert.ok(Math.abs(Number(match[1]) - 100) < 0.11);
});

test('chartModel marks the peak and the settle time for an underdamped spring', () => {
  const model = chartModel(spring(600, 28, 1));
  assert.ok(model.peak && model.peak.label.startsWith('peak +9.0'), model.peak?.label);
  assert.ok(model.settle);
  assert.deepEqual(model.xLabels.map(label => label.anchor), ['start', 'middle', 'end']);
  assert.equal(model.xLabels[0].text, '0 ms');
  assert.match(model.xLabels[2].text, /^\d+ ms$/);
  assert.equal(model.yLabels.map(label => label.text).join(','), '0,1.0');
  assert.ok(model.band.height > 0);
});

test('chartModel omits the peak for a critically damped spring', () => {
  const model = chartModel(spring(600, 48.99, 1));
  assert.equal(model.peak, null);
  assert.ok(model.settle);
});

test('chartModel keeps the time span between half a second and six seconds', () => {
  assert.equal(chartModel(spring(1200, 20, 0.5)).seconds >= 0.5, true);
  assert.equal(chartModel(spring(40, 2, 3)).seconds <= 6, true);
  assert.equal(chartModel(spring(1200, 2, 3)).settle, null);
});

test('chartModel keeps the labels inside the plot', () => {
  for (const preset of SPRING_PRESETS) {
    const model = chartModel(preset.params);
    const right = model.plot.left + model.plot.width;
    if (model.peak) assert.ok(model.peak.labelX <= right - 70 + 1e-9);
    if (model.settle) assert.ok(model.settle.labelX <= right - 80 + 1e-9);
  }
});

test('glyphModel draws the Mechanical curve inside its box', () => {
  const glyph = glyphModel();
  assert.equal(glyph.width, 160);
  assert.equal(glyph.height, 110);
  assert.match(glyph.curve, /^M8\.0 /);
  const numbers = glyph.curve.match(/-?\d+\.\d/g).map(Number);
  assert.ok(numbers.every(value => value >= -1 && value <= 161));
  assert.ok(glyph.baselineY > 8 && glyph.baselineY < 102);
});

test('describeSpring gives a text alternative with the measured numbers', () => {
  const text = describeSpring(spring(600, 28, 1));
  assert.match(text, /overshoots/);
  assert.match(text, /9\.0 percent/);
  assert.match(text, /\d+ milliseconds/);
  assert.match(describeSpring(spring(600, 48.99, 1)), /does not overshoot/);
  assert.match(describeSpring(spring(1200, 2, 3)), /does not settle within 8 seconds/);
});

test('advanceSpring moves toward the target and rests exactly on it', () => {
  let state = { position: 0, velocity: 0, carry: 0 };
  let resting = false;
  for (let frame = 0; frame < 600 && !resting; frame++) {
    ({ state, resting } = advanceSpring(state, MECHANICAL, 1, 1 / 60));
  }
  assert.equal(resting, true);
  assert.equal(state.position, 1);
  assert.equal(state.velocity, 0);
});

test('advanceSpring lands in the same place at 30, 60, and 144 frames per second', () => {
  const positions = [30, 60, 144].map(rate => {
    let state = { position: 0, velocity: 0, carry: 0 };
    for (let frame = 0; frame < rate * 0.3; frame++) {
      ({ state } = advanceSpring(state, MECHANICAL, 1, 1 / rate));
    }
    return state.position;
  });
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.03, positions.join(', '));
});

test('advanceSpring caps a long pause at the maximum frame time', () => {
  const start = { position: 0, velocity: 0, carry: 0 };
  const long = advanceSpring(start, MECHANICAL, 1, 30).state;
  const capped = advanceSpring(start, MECHANICAL, 1, MAX_FRAME_SECONDS).state;
  assert.deepEqual(long, capped);
});

test('advanceSpring keeps the leftover time between frames', () => {
  const start = { position: 0, velocity: 0, carry: 0 };
  const { state } = advanceSpring(start, MECHANICAL, 1, STEP_SECONDS * 1.5);
  assert.ok(state.carry > 0 && state.carry < STEP_SECONDS);
});

test('advanceSpring keeps its velocity when the target flips mid-flight', () => {
  let state = { position: 0, velocity: 0, carry: 0 };
  for (let frame = 0; frame < 6; frame++) ({ state } = advanceSpring(state, MECHANICAL, 1, 1 / 60));
  assert.ok(state.velocity > 0);
  const flipped = advanceSpring(state, MECHANICAL, 0, 1 / 60).state;
  assert.ok(flipped.velocity < state.velocity);
  assert.ok(flipped.position > state.position - 0.2);
});

test('a compact chart draws larger labels and keeps them inside the plot', () => {
  for (const preset of SPRING_PRESETS) {
    const wide = chartModel(preset.params);
    const compact = chartModel(preset.params, true);
    assert.ok(compact.fontSize > wide.fontSize);
    assert.equal(compact.curve, wide.curve);
    const right = compact.plot.left + compact.plot.width;
    if (compact.peak) assert.ok(compact.peak.labelX <= right - 70 * 1.8 + 1e-9);
    if (compact.settle) assert.ok(compact.settle.labelY > compact.plot.top + compact.plot.height / 2, 'The settle label sits low');
    for (const label of compact.xLabels) assert.ok(label.y < compact.height);
  }
});
