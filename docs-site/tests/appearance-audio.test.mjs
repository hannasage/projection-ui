import test from 'node:test';
import assert from 'node:assert/strict';
import { AppearanceAudio } from '../lib/appearance-audio.ts';

function fixture(state = 'running') {
  const statuses = [];
  const oscillators = [];
  const gains = [];
  const pending = [];
  const parameter = () => ({ value: 0, calls: [], setValueAtTime(...args) { this.calls.push(args); }, linearRampToValueAtTime(...args) { this.calls.push(args); }, exponentialRampToValueAtTime(...args) { this.calls.push(args); }, cancelScheduledValues(...args) { this.calls.push(args); }, setTargetAtTime(...args) { this.calls.push(args); } });
  const context = {
    state, currentTime: 10, destination: {}, closed: false,
    createGain() { const node = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } }; gains.push(node); return node; },
    createOscillator() { const node = { frequency: parameter(), type: '', starts: [], stops: [], connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); } }; oscillators.push(node); return node; },
    resume() { return new Promise((resolve, reject) => pending.push({ resolve: () => { context.state = 'running'; resolve(); }, reject })); },
    close() { this.closed = true; return Promise.resolve(); },
  };
  const audio = new AppearanceAudio(() => context, status => statuses.push(status));
  return { audio, context, oscillators, gains, pending, statuses };
}

test('Modern uses a quiet finite cue, and Flat cancels every previous voice', async () => {
  const f = fixture();
  assert.equal(await f.audio.play('modern'), true);
  assert.equal(f.oscillators.length, 8);
  assert.equal(f.gains[0].gain.value, .15);
  assert.ok(f.oscillators.every(node => node.stops[0] <= 11.35));
  const modern = [...f.oscillators];
  assert.equal(await f.audio.play('flat', true), true);
  assert.ok(modern.every(node => node.stops.at(-1) === 10.02));
  assert.equal(f.oscillators.length, 10);
  assert.ok(f.oscillators.slice(8).every(node => node.stops[0] <= 10.28));
  assert.deepEqual(f.gains[0].gain.calls.at(-1), [0, 10, .004]);
});

test('a blocked load never queues sound for an unrelated later click', async () => {
  const f = fixture('suspended');
  assert.equal(await f.audio.play('modern'), false);
  assert.deepEqual(f.statuses, ['blocked']);
  assert.equal(f.pending.length, 0);
  assert.equal(f.oscillators.length, 0);
});

test('Flat wins when an earlier Modern resume resolves late', async () => {
  const f = fixture('suspended');
  const modern = f.audio.play('modern', true);
  const flat = f.audio.play('flat', true);
  f.pending[1].resolve();
  assert.equal(await flat, true);
  f.pending[0].resolve();
  assert.equal(await modern, false);
  assert.equal(f.oscillators.length, 2);
  assert.ok(f.oscillators.every(node => node.type === 'triangle'));
});

test('a rejected stale resume cannot cancel the winning cue', async () => {
  const f = fixture('suspended');
  const old = f.audio.play('modern', true);
  const winning = f.audio.play('flat', true);
  f.pending[1].resolve();
  await winning;
  f.pending[0].reject(new Error('Not allowed'));
  assert.equal(await old, false);
  assert.ok(f.oscillators.every(node => node.stops.length === 1));
  assert.deepEqual(f.statuses, ['ready']);
});

test('mute and disposal stop sound, close the context, and invalidate pending starts', async () => {
  const f = fixture();
  await f.audio.play('modern');
  f.audio.stop();
  assert.ok(f.oscillators.every(node => node.stops.length === 2));
  f.context.state = 'suspended';
  const pending = f.audio.play('modern', true);
  f.audio.dispose();
  f.pending[0].resolve();
  assert.equal(await pending, false);
  assert.equal(f.context.closed, true);
  assert.equal(f.oscillators.length, 8);
});

test('finished voices disconnect their envelopes and output', async () => {
  const f = fixture();
  await f.audio.play('flat');
  for (const source of f.oscillators) source.onended();
  assert.ok(f.oscillators.every(node => node.disconnected));
  assert.ok(f.gains.every(node => node.disconnected));
});

test('unsupported audio and rejected resumes leave a usable silent page', async () => {
  const statuses = [];
  const unavailable = new AppearanceAudio(() => { throw new Error('Unsupported'); }, status => statuses.push(status));
  assert.equal(await unavailable.play('modern'), false);
  assert.deepEqual(statuses, ['unavailable']);
  const f = fixture('suspended');
  const play = f.audio.play('modern', true);
  f.pending[0].reject(new Error('Not allowed'));
  assert.equal(await play, false);
  assert.deepEqual(f.statuses, ['blocked']);
});
